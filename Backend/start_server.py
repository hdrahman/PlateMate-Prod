import uvicorn
import argparse

def main():
    parser = argparse.ArgumentParser(description="Start PlateMate backend server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind the server to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the server to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload on code changes")
    args = parser.parse_args()
    
    # Use extended timeouts for AI API requests (nutrition analysis)
    uvicorn.run(
        "main:app", 
        host=args.host, 
        port=args.port, 
        reload=args.reload,
        timeout_keep_alive=65,      # Keep-alive timeout for idle connections
    )

if __name__ == "__main__":
    main() 