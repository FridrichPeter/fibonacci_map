# Fibonacci Sequence on Map

This project visualizes the Fibonacci sequence as points on a map, starting at Ciudad Mitad del Mundo, using Python with ArcPy and the EPSG:3857 spatial reference system.

## Features

- Generates points based on the Fibonacci sequence.
- First point starts exactly at Ciudad Mitad del Mundo.
- Uses EPSG:3857 (Web Mercator) for coordinate projection.

## Requirements

- ArcGIS Pro
- Python 3.x with ArcPy module

## Usage

1. Clone the repository.
2. Set up the workspace in ArcGIS Pro.
3. Run the `fibonacci_points.py` script to generate the points in a feature class.

```bash
git clone https://github.com/FridrichPeter/fibonacci_map.git
