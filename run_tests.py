#!/usr/bin/env python3
"""
Comprehensive Test Runner for PlateMate
Runs both backend (pytest) and frontend (jest) tests with various options
"""

import os
import sys
import subprocess
import argparse
import time
from datetime import datetime


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_colored(message, color=Colors.ENDC):
    """Print message with color"""
    print(f"{color}{message}{Colors.ENDC}")


def run_command(command, cwd=None):
    """Run a command and return the result"""
    print_colored(f"Running: {command}", Colors.OKBLUE)
    start_time = time.time()
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes timeout
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if result.returncode == 0:
            print_colored(f"✓ Command completed successfully in {duration:.2f}s", Colors.OKGREEN)
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print_colored(f"✗ Command failed in {duration:.2f}s", Colors.FAIL)
            if result.stderr:
                print_colored("STDERR:", Colors.WARNING)
                print(result.stderr)
            if result.stdout:
                print_colored("STDOUT:", Colors.WARNING)
                print(result.stdout)
            return False
            
    except subprocess.TimeoutExpired:
        print_colored("✗ Command timed out", Colors.FAIL)
        return False
    except Exception as e:
        print_colored(f"✗ Error running command: {e}", Colors.FAIL)
        return False


def setup_backend_environment():
    """Setup backend test environment"""
    print_colored("Setting up backend test environment...", Colors.HEADER)
    
    # Check if virtual environment exists
    if not os.path.exists("Backend/env"):
        print_colored("Creating virtual environment...", Colors.WARNING)
        if not run_command("python -m venv env", cwd="Backend"):
            return False
    
    # Install dependencies
    pip_cmd = "Backend/env/Scripts/pip" if os.name == 'nt' else "Backend/env/bin/pip"
    if not run_command(f"{pip_cmd} install -r requirements.txt", cwd="Backend"):
        print_colored("Failed to install backend dependencies", Colors.FAIL)
        return False
    
    # Install test dependencies
    test_deps = [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
        "pytest-asyncio>=0.21.0",
        "pytest-xdist>=3.0.0",
        "pytest-mock>=3.10.0",
        "httpx>=0.24.0",
        "requests-mock>=1.10.0"
    ]
    
    for dep in test_deps:
        if not run_command(f"{pip_cmd} install {dep}", cwd="Backend"):
            print_colored(f"Failed to install {dep}", Colors.WARNING)
    
    return True


def setup_frontend_environment():
    """Setup frontend test environment"""
    print_colored("Setting up frontend test environment...", Colors.HEADER)
    
    # Check if node_modules exists
    if not os.path.exists("Frontend/node_modules"):
        print_colored("Installing frontend dependencies...", Colors.WARNING)
        if not run_command("npm install", cwd="Frontend"):
            return False
    
    # Install test dependencies
    test_deps = [
        "@testing-library/react-native@^11.5.0",
        "@testing-library/jest-native@^5.4.0",
        "jest@^29.0.0",
        "babel-jest@^29.0.0",
        "react-test-renderer@^18.0.0",
        "jest-environment-jsdom@^29.0.0"
    ]
    
    deps_str = " ".join(test_deps)
    if not run_command(f"npm install --save-dev {deps_str}", cwd="Frontend"):
        print_colored("Failed to install frontend test dependencies", Colors.WARNING)
    
    return True


def run_backend_tests(args):
    """Run backend tests with pytest"""
    print_colored("\n" + "="*60, Colors.HEADER)
    print_colored("RUNNING BACKEND TESTS", Colors.HEADER)
    print_colored("="*60, Colors.HEADER)
    
    if not setup_backend_environment():
        return False
    
    # Build pytest command
    python_cmd = "Backend/env/Scripts/python" if os.name == 'nt' else "Backend/env/bin/python"
    pytest_cmd = f"{python_cmd} -m pytest"
    
    # Add coverage if requested
    if args.coverage:
        pytest_cmd += " --cov=Backend --cov-report=html:Backend/htmlcov --cov-report=term-missing"
    
    # Add specific test markers
    if args.unit:
        pytest_cmd += " -m unit"
    elif args.integration:
        pytest_cmd += " -m integration"
    elif args.api:
        pytest_cmd += " -m api"
    
    # Add parallel execution
    if args.parallel:
        pytest_cmd += " -n auto"
    
    # Add verbosity
    if args.verbose:
        pytest_cmd += " -v"
    else:
        pytest_cmd += " -q"
    
    # Add specific test file/directory
    if args.test_path:
        pytest_cmd += f" {args.test_path}"
    else:
        pytest_cmd += " Backend/tests/"
    
    # Add additional pytest arguments
    if args.pytest_args:
        pytest_cmd += f" {args.pytest_args}"
    
    return run_command(pytest_cmd, cwd=".")


def run_frontend_tests(args):
    """Run frontend tests with Jest"""
    print_colored("\n" + "="*60, Colors.HEADER)
    print_colored("RUNNING FRONTEND TESTS", Colors.HEADER)
    print_colored("="*60, Colors.HEADER)
    
    if not setup_frontend_environment():
        return False
    
    # Build Jest command
    jest_cmd = "npm test"
    
    # Add coverage if requested
    if args.coverage:
        jest_cmd += " -- --coverage"
    
    # Add watch mode
    if args.watch:
        jest_cmd += " -- --watch"
    
    # Add specific test file
    if args.test_path:
        jest_cmd += f" -- {args.test_path}"
    
    # Add verbosity
    if args.verbose:
        jest_cmd += " -- --verbose"
    
    # Add additional Jest arguments
    if args.jest_args:
        jest_cmd += f" -- {args.jest_args}"
    
    return run_command(jest_cmd, cwd="Frontend")


def run_lint_checks():
    """Run linting and code quality checks"""
    print_colored("\n" + "="*60, Colors.HEADER)
    print_colored("RUNNING LINT CHECKS", Colors.HEADER)
    print_colored("="*60, Colors.HEADER)
    
    success = True
    
    # Backend linting with flake8
    print_colored("Running backend linting...", Colors.OKBLUE)
    if not run_command("flake8 Backend/ --max-line-length=100 --exclude=Backend/env/", cwd="."):
        success = False
    
    # Frontend linting with ESLint
    print_colored("Running frontend linting...", Colors.OKBLUE)
    if not run_command("npm run lint", cwd="Frontend"):
        success = False
    
    return success


def generate_test_report():
    """Generate comprehensive test report"""
    print_colored("\n" + "="*60, Colors.HEADER)
    print_colored("GENERATING TEST REPORT", Colors.HEADER)
    print_colored("="*60, Colors.HEADER)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_dir = f"test_reports_{timestamp}"
    os.makedirs(report_dir, exist_ok=True)
    
    # Copy coverage reports
    import shutil
    
    try:
        if os.path.exists("Backend/htmlcov"):
            shutil.copytree("Backend/htmlcov", f"{report_dir}/backend_coverage")
            print_colored("✓ Backend coverage report copied", Colors.OKGREEN)
        
        if os.path.exists("Frontend/coverage"):
            shutil.copytree("Frontend/coverage", f"{report_dir}/frontend_coverage")
            print_colored("✓ Frontend coverage report copied", Colors.OKGREEN)
        
        # Create summary report
        with open(f"{report_dir}/test_summary.txt", "w") as f:
            f.write(f"PlateMate Test Report\n")
            f.write(f"Generated: {datetime.now()}\n")
            f.write(f"="*50 + "\n\n")
            f.write("Test Coverage Reports:\n")
            f.write(f"- Backend: {report_dir}/backend_coverage/index.html\n")
            f.write(f"- Frontend: {report_dir}/frontend_coverage/lcov-report/index.html\n\n")
        
        print_colored(f"✓ Test report generated in {report_dir}/", Colors.OKGREEN)
        return True
        
    except Exception as e:
        print_colored(f"✗ Error generating report: {e}", Colors.FAIL)
        return False


def main():
    """Main test runner function"""
    parser = argparse.ArgumentParser(description="PlateMate Comprehensive Test Runner")
    
    # Test selection
    parser.add_argument("--backend", "-b", action="store_true", help="Run backend tests only")
    parser.add_argument("--frontend", "-f", action="store_true", help="Run frontend tests only")
    parser.add_argument("--unit", "-u", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", "-i", action="store_true", help="Run integration tests only")
    parser.add_argument("--api", "-a", action="store_true", help="Run API tests only")
    
    # Test options
    parser.add_argument("--coverage", "-c", action="store_true", help="Generate coverage report")
    parser.add_argument("--parallel", "-p", action="store_true", help="Run tests in parallel")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--watch", "-w", action="store_true", help="Watch mode (frontend only)")
    parser.add_argument("--lint", "-l", action="store_true", help="Run linting checks")
    parser.add_argument("--report", "-r", action="store_true", help="Generate comprehensive report")
    
    # Path and arguments
    parser.add_argument("--test-path", "-t", help="Specific test file or directory")
    parser.add_argument("--pytest-args", help="Additional pytest arguments")
    parser.add_argument("--jest-args", help="Additional Jest arguments")
    
    # Environment setup
    parser.add_argument("--setup", "-s", action="store_true", help="Setup test environments only")
    parser.add_argument("--clean", action="store_true", help="Clean test artifacts")
    
    args = parser.parse_args()
    
    print_colored("PlateMate Comprehensive Test Runner", Colors.HEADER)
    print_colored("="*60, Colors.HEADER)
    print_colored(f"Started at: {datetime.now()}", Colors.OKBLUE)
    
    success = True
    
    # Clean artifacts if requested
    if args.clean:
        print_colored("Cleaning test artifacts...", Colors.WARNING)
        artifacts = ["Backend/htmlcov", "Frontend/coverage", "Backend/.pytest_cache", 
                    "Frontend/node_modules/.cache", "test_reports_*", "*.log"]
        for artifact in artifacts:
            run_command(f"rm -rf {artifact}", cwd=".")
    
    # Setup environments if requested
    if args.setup:
        success &= setup_backend_environment()
        success &= setup_frontend_environment()
        if success:
            print_colored("✓ Test environments setup complete", Colors.OKGREEN)
        return 0 if success else 1
    
    # Run linting if requested
    if args.lint:
        success &= run_lint_checks()
    
    # Determine which tests to run
    run_backend = args.backend or (not args.frontend and not args.backend)
    run_frontend = args.frontend or (not args.frontend and not args.backend)
    
    # Run backend tests
    if run_backend:
        success &= run_backend_tests(args)
    
    # Run frontend tests  
    if run_frontend:
        success &= run_frontend_tests(args)
    
    # Generate report if requested
    if args.report:
        generate_test_report()
    
    # Print summary
    print_colored("\n" + "="*60, Colors.HEADER)
    if success:
        print_colored("✓ ALL TESTS COMPLETED SUCCESSFULLY", Colors.OKGREEN)
    else:
        print_colored("✗ SOME TESTS FAILED", Colors.FAIL)
    
    print_colored(f"Completed at: {datetime.now()}", Colors.OKBLUE)
    print_colored("="*60, Colors.HEADER)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main()) 