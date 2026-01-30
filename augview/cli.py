"""
CLI module for AugView
"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        description="AugView - Image Augmentation Pipeline Visualizer"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Serve command
    serve_parser = subparsers.add_parser("serve", help="Start the visualization server")
    serve_parser.add_argument(
        "--host", 
        default="127.0.0.1", 
        help="Host to bind to (default: 127.0.0.1)"
    )
    serve_parser.add_argument(
        "--port", 
        type=int, 
        default=8080, 
        help="Port to bind to (default: 8080)"
    )
    serve_parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't open browser automatically"
    )
    serve_parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable hot reload for development"
    )
    
    args = parser.parse_args()
    
    if args.command == "serve":
        from .server import start_server
        start_server(
            host=args.host,
            port=args.port,
            open_browser=not args.no_browser,
            reload=args.reload
        )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
