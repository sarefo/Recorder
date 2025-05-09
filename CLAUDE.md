# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a browser-based web application for displaying and playing ABC music notation for recorder music, including fingering diagrams.

## Running the Application
- Run a local development server: `bash scripts/run_server.sh`
- Generate ABC file list: `python scripts/generate_abc_file_list.py`

## Code Style Guidelines
- Use ES6 class-based architecture with clear separation of concerns
- Follow camelCase naming for methods and properties
- Use JSDoc comments for method documentation
- Avoid external dependencies beyond the abcjs library
- Handle errors with try/catch blocks and provide meaningful error messages
- Maintain mobile-friendly responsive design
- Keep code modular with classes having single responsibilities
- Follow existing patterns for event handling and DOM manipulation
- Maintain compatibility with the abcjs library API
- Add new music files in the appropriate folders within the /abc directory