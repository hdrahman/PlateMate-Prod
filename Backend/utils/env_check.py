import os
import logging
import re

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('env_check')

def check_env_file():
    """Check and fix .env file for null characters and other issues."""
    # Find the .env file
    env_paths = [
        './.env',
        '../.env', 
        './Backend/.env',
        os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    ]
    
    env_file = None
    for path in env_paths:
        if os.path.exists(path):
            env_file = path
            logger.info(f"Found .env file at {os.path.abspath(path)}")
            break
    
    if not env_file:
        logger.error("Could not find .env file")
        return False
    
    try:
        # Read the file as binary to detect null characters
        with open(env_file, 'rb') as f:
            content = f.read()
        
        # Check for null characters
        if b'\x00' in content:
            logger.warning("Null characters detected in .env file. Fixing...")
            
            # Remove null characters
            content = content.replace(b'\x00', b'')
            
            # Write back to the file
            with open(env_file, 'wb') as f:
                f.write(content)
            
            logger.info("Removed null characters from .env file")
        
        # Read the cleaned file
        with open(env_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Check for other issues in each line
        fixed_lines = []
        fixed = False
        
        for line in lines:
            # Skip comments and empty lines
            if line.strip().startswith('#') or not line.strip():
                fixed_lines.append(line)
                continue
                
            # Check if line has proper KEY=VALUE format
            if '=' not in line:
                logger.warning(f"Invalid line in .env file: {line.strip()}")
                fixed = True
                continue
            
            # Fix any invalid characters
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()
            
            # Remove quotes if they're mismatched
            if (value.startswith('"') and not value.endswith('"')) or \
               (value.startswith("'") and not value.endswith("'")):
                value = value[1:]
                fixed = True
            
            # Final line
            fixed_line = f"{key}={value}\n"
            fixed_lines.append(fixed_line)
        
        # Write back if any issues were fixed
        if fixed:
            logger.info("Fixed issues with .env file format")
            with open(env_file, 'w', encoding='utf-8') as f:
                f.writelines(fixed_lines)
        
        logger.info(".env file check completed successfully")
        return True
    
    except Exception as e:
        logger.error(f"Error checking .env file: {e}")
        return False

if __name__ == "__main__":
    check_env_file() 