"""
Pytest configuration file.
Ensures that tests run with the correct working directory.
"""

import os
import pytest


def pytest_configure(config):
    """
    Set the working directory to the project root before tests run.
    This ensures that relative paths and data file access work correctly.
    """
    # Get the directory containing the conftest.py file
    conftest_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to the project root
    project_root = os.path.dirname(conftest_dir)
    # Change to project root
    os.chdir(project_root)
    print(f"Changed working directory to: {os.getcwd()}")

