import arcpy
import math

# Nastavenie cesty k workspace -
arcpy.env.workspace = r"C:\cesta\fibonacci\Default.gdb"

# Definovanie súradnicového systému EPSG 3857 (WGS 84 Web Mercator)
spatial_ref = arcpy.SpatialReference(3857)

# Vytvorenie novej feature class pre body
out_fc = "fibonacci_points"
arcpy.CreateFeatureclass_management(arcpy.env.workspace, out_fc, "POINT", spatial_reference=spatial_ref)

# Pridanie poľa pre hodnoty Fibonacciho postupnosti
arcpy.AddField_management(out_fc, "Fibonacci", "LONG")


# Funkcia na generovanie Fibonacciho postupnosti
def fibonacci(n):
    a, b = 0, 1
    fib_sequence = []
    for _ in range(n):
        fib_sequence.append(b)
        a, b = b, a + b
    return fib_sequence


# Počet bodov
num_points = 20
fib_sequence = fibonacci(num_points)

# Súradnice Ciudad Mitad del Mundo (presné WGS84 súradnice)
latitude = -0.002113206204556048  # 0°0′8″ južnej šírky (v desatinných stupňoch)
longitude = -78.45575156968523  # 78°27′21″ západnej dĺžky (v desatinných stupňoch)

# Konverzia súradníc z WGS84 (EPSG 4326) na EPSG 3857
point_geo = arcpy.Point(longitude, latitude)
point_projected = arcpy.PointGeometry(point_geo, arcpy.SpatialReference(4326)).projectAs(spatial_ref)

# Skontrolujte súradnice po konverzii
print(f"Premietnuté súradnice X: {point_projected.centroid.X}, Y: {point_projected.centroid.Y}")

# Vložte nové body do feature class
with arcpy.da.InsertCursor(out_fc, ["SHAPE@", "Fibonacci"]) as cursor:
    for i, fib in enumerate(fib_sequence):
        if i == 0:
            # Prvý bod priamo na súradniciach Ciudad Mitad del Mundo
            point = arcpy.Point(point_projected.centroid.X, point_projected.centroid.Y)
        else:
            # Definovanie polárnych súradníc založených na Fibonacciho sekvencii
            r = fib * 1000  # vzdialenosť v metroch (násobenie je pre škálovanie)
            theta = i * (math.pi / 4)  # uhol, ktorý sa mení s i (napr. každých 45 stupňov)

            # Konverzia polárnych súradníc na kartézske
            x = point_projected.centroid.X + r * math.cos(theta)
            y = point_projected.centroid.Y + r * math.sin(theta)

            # Vytvorenie bodu
            point = arcpy.Point(x, y)

        # Vložte bod do geodatabázy
        cursor.insertRow([point, fib])

print("Hotovo! Body Fibonacciho postupnosti sú pripravené v geodatabáze.")
