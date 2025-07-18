import os
import shutil
import hashlib
import time
from pathlib import Path
from typing import Optional, List, Tuple
from fastapi import UploadFile, HTTPException
import uuid
from PIL import Image
import io

# Configuration
UPLOAD_DIR = Path("uploads")
IMAGES_DIR = UPLOAD_DIR / "images"
TEMP_DIR = UPLOAD_DIR / "temp"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

class FileManager:
    """Comprehensive file management for image uploads"""
    
    @staticmethod
    def validate_image_file(file: UploadFile) -> bool:
        """Validate uploaded image file"""
        # Check file extension
        if file.filename:
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
                )
        
        # Check MIME type
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid MIME type. Allowed: {', '.join(ALLOWED_MIME_TYPES)}"
            )
        
        return True
    
    @staticmethod
    def generate_unique_filename(user_id: int, original_filename: Optional[str] = None) -> str:
        """Generate a unique filename for the uploaded image"""
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        
        # Extract extension from original filename
        if original_filename:
            ext = Path(original_filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                ext = ".jpg"  # Default fallback
        else:
            ext = ".jpg"
        
        return f"user_{user_id}_{timestamp}_{unique_id}{ext}"
    
    @staticmethod
    def save_image_file(file: UploadFile, user_id: int) -> Tuple[str, str]:
        """
        Save uploaded image file to disk
        Returns: (file_path, url_path)
        """
        try:
            # Validate the file
            FileManager.validate_image_file(file)
            
            # Check file size
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()
            file.file.seek(0)  # Reset to beginning
            
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
                )
            
            # Generate unique filename
            filename = FileManager.generate_unique_filename(user_id, file.filename)
            file_path = IMAGES_DIR / filename
            
            # Save file to disk
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Generate URL path
            url_path = f"/static/images/{filename}"
            
            print(f"✅ Saved image: {filename} ({file_size} bytes)")
            return str(file_path), url_path
            
        except Exception as e:
            print(f"❌ Error saving image file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")
    
    @staticmethod
    def save_multiple_images(files: List[UploadFile], user_id: int) -> List[Tuple[str, str]]:
        """
        Save multiple image files
        Returns: List of (file_path, url_path) tuples
        """
        saved_files = []
        
        try:
            for i, file in enumerate(files):
                try:
                    file_path, url_path = FileManager.save_image_file(file, user_id)
                    saved_files.append((file_path, url_path))
                except Exception as e:
                    # If any file fails, clean up already saved files
                    FileManager.cleanup_files([fp for fp, _ in saved_files])
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to save image {i+1}: {str(e)}"
                    )
            
            return saved_files
            
        except Exception as e:
            # Clean up any files that were saved before the error
            FileManager.cleanup_files([fp for fp, _ in saved_files])
            raise e
    
    @staticmethod
    def optimize_image(file_path: str, max_width: int = 2000, quality: int = 95) -> bool:
        """
        Optimize image for web delivery while maintaining high quality for AI analysis
        NOTE: Currently unused since frontend uses local storage, but kept for potential future use
        Returns: True if optimization successful, False otherwise
        """
        try:
            with Image.open(file_path) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Resize if larger than max_width
                if img.width > max_width:
                    ratio = max_width / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                
                # Save optimized image with higher quality
                img.save(file_path, "JPEG", quality=quality, optimize=True)
                
            print(f"✅ Optimized image: {file_path}")
            return True
            
        except Exception as e:
            print(f"⚠️ Failed to optimize image {file_path}: {e}")
            return False
    
    @staticmethod
    def delete_file(file_path: str) -> bool:
        """Delete a single file"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"✅ Deleted file: {file_path}")
                return True
            return False
        except Exception as e:
            print(f"❌ Error deleting file {file_path}: {e}")
            return False
    
    @staticmethod
    def cleanup_files(file_paths: List[str]) -> int:
        """Clean up multiple files. Returns number of files successfully deleted."""
        deleted_count = 0
        for file_path in file_paths:
            if FileManager.delete_file(file_path):
                deleted_count += 1
        return deleted_count
    
    @staticmethod
    def get_file_info(file_path: str) -> Optional[dict]:
        """Get information about a file"""
        try:
            if not os.path.exists(file_path):
                return None
            
            stat = os.stat(file_path)
            return {
                "path": file_path,
                "size": stat.st_size,
                "created": stat.st_ctime,
                "modified": stat.st_mtime,
                "exists": True
            }
        except Exception as e:
            print(f"❌ Error getting file info for {file_path}: {e}")
            return None
    
    @staticmethod
    def cleanup_old_files(days_old: int = 30) -> int:
        """Clean up files older than specified days. Returns number of files deleted."""
        cutoff_time = time.time() - (days_old * 24 * 60 * 60)
        deleted_count = 0
        
        try:
            for file_path in IMAGES_DIR.glob("*"):
                if file_path.is_file():
                    file_stat = file_path.stat()
                    if file_stat.st_mtime < cutoff_time:
                        try:
                            file_path.unlink()
                            deleted_count += 1
                            print(f"🗑️ Deleted old file: {file_path.name}")
                        except Exception as e:
                            print(f"❌ Failed to delete old file {file_path}: {e}")
            
            print(f"✅ Cleaned up {deleted_count} old files")
            return deleted_count
            
        except Exception as e:
            print(f"❌ Error during cleanup: {e}")
            return deleted_count
    
    @staticmethod
    def get_storage_stats() -> dict:
        """Get storage statistics"""
        try:
            total_files = 0
            total_size = 0
            
            for file_path in IMAGES_DIR.glob("*"):
                if file_path.is_file():
                    total_files += 1
                    total_size += file_path.stat().st_size
            
            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "images_directory": str(IMAGES_DIR),
                "upload_directory": str(UPLOAD_DIR)
            }
        except Exception as e:
            print(f"❌ Error getting storage stats: {e}")
            return {"error": str(e)}
    
    @staticmethod
    def prepare_image_for_ai_analysis(file_path: str) -> str:
        """
        Prepare image for OpenAI analysis - only create separate file if processing is needed
        Returns: Path to the analysis-ready image file
        """
        try:
            with Image.open(file_path) as img:
                # Check if image needs any processing
                needs_processing = False
                
                # Check if format conversion needed
                if img.mode in ('RGBA', 'P'):
                    needs_processing = True
                
                # Check if resizing needed (only if extremely large >4000px)
                if img.width > 4000:
                    needs_processing = True
                
                # If no processing needed, return original file
                if not needs_processing:
                    print(f"✅ Using original image for AI analysis (no processing needed): {file_path}")
                    return file_path
                
                # Create a separate high-quality file path only if processing is needed
                base_path = Path(file_path)
                ai_analysis_path = base_path.parent / f"ai_analysis_{base_path.name}"
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Only resize if extremely large (>4000px) to preserve more detail
                if img.width > 4000:
                    ratio = 4000 / img.width
                    new_height = int(img.height * ratio)
                    img = img.resize((4000, new_height), Image.Resampling.LANCZOS)
                
                # Save with maximum quality for AI analysis - no optimization to preserve all data
                img.save(str(ai_analysis_path), "JPEG", quality=100, optimize=False)
                
            print(f"✅ Created high-quality AI analysis image: {ai_analysis_path}")
            return str(ai_analysis_path)
            
        except Exception as e:
            print(f"⚠️ Failed to create AI analysis image {file_path}: {e}")
            # Fall back to original file if creation fails
            return file_path