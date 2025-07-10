# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a browser-based web application for displaying and playing ABC music notation for recorder music, including fingering diagrams.

## Running the Application
- The development server is already running at http://localhost:8000/Recorder
- Update ABC and docs file lists: `python3 scripts/update_data.py`

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

## MCP Server Usage
- Use the Context7 MCP server (mcp__context7__*) when working with external libraries or frameworks to get up-to-date documentation and examples
- This helps ensure compatibility and follows best practices for third-party dependencies

## Mobile Testing
- When testing mobile, test for landscape in pixel 7a (915x412) and pixel 4a (393x851)