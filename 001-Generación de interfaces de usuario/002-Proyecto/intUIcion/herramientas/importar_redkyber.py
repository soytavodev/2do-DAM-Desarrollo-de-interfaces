"""
Importa los datos de demostración de REDKYBER (mi ERP de Sistemas de gestión
empresarial) y genera los orígenes de datos JSON que consume intUIción.

Cada JSON describe una entidad completa:
  - titulo / descripcion / icono
  - columnas: qué se ve en la tabla y con qué formato
  - campos:   cómo se genera el formulario y qué se valida
  - registros: los datos

Uso:
  python3 herramientas/importar_redkyber.py <ruta a demo.sql de REDKYBER>
"""
import json
import sqlite3
import sys
from pathlib import Path

DESTINO = Path(__file__).resolve().parent.parent / "data"

ENTIDADES = {
    "clientes": {
        "titulo": "Aerolíneas cliente",
        "descripcion": "Compañías que compran aeronaves a REDKYBER.",
        "icono": "✈",
        "columnas": [
            {"campo": "nombre", "etiqueta": "Aerolínea"},
            {"campo": "pais", "etiqueta": "País"},
            {"campo": "telefono", "etiqueta": "Teléfono", "formato": "mono"},
            {"campo": "email", "etiqueta": "Email", "formato": "email"},
        ],
        "campos": [
            {"nombre": "nombre", "etiqueta": "Aerolínea", "tipo": "text", "requerido": True, "min": 2},
            {"nombre": "pais", "etiqueta": "País", "tipo": "text", "requerido": True,
             "sugerencias": ["España", "Alemania", "Francia", "Reino Unido", "Estados Unidos", "Japón", "Canadá"]},
            {"nombre": "telefono", "etiqueta": "Teléfono", "tipo": "tel", "patron": "^[0-9 +]{9,15}$",
             "ayuda": "Solo números, de 9 a 15 cifras"},
            {"nombre": "email", "etiqueta": "Email de compras", "tipo": "email", "requerido": True},
        ],
    },
    "pedidos": {
        "titulo": "Pedidos",
        "descripcion": "Pedidos de aeronaves y su estado de fabricación.",
        "icono": "▤",
        "columnas": [
            {"campo": "identificador", "etiqueta": "Nº", "formato": "mono"},
            {"campo": "fecha", "etiqueta": "Fecha", "formato": "fecha"},
            {"campo": "cliente_id", "etiqueta": "Cliente", "formato": "referencia"},
            {"campo": "estado", "etiqueta": "Estado", "formato": "estado"},
            {"campo": "total", "etiqueta": "Total", "formato": "moneda", "sumar": True},
        ],
        "campos": [
            {"nombre": "fecha", "etiqueta": "Fecha", "tipo": "date", "requerido": True},
            {"nombre": "cliente_id", "etiqueta": "Cliente", "tipo": "referencia", "entidad": "clientes",
             "mostrar": "nombre", "requerido": True},
            {"nombre": "estado", "etiqueta": "Estado", "tipo": "select", "requerido": True,
             "opciones": ["Pendiente", "Confirmado", "En fabricación", "Entregado"]},
            {"nombre": "total", "etiqueta": "Total (€)", "tipo": "number", "requerido": True, "minimo": 0},
        ],
    },
    "productos": {
        "titulo": "Aeronaves",
        "descripcion": "Catálogo de modelos que fabrica REDKYBER.",
        "icono": "◭",
        "columnas": [
            {"campo": "nombre", "etiqueta": "Modelo"},
            {"campo": "tipo", "etiqueta": "Tipo", "formato": "etiqueta"},
            {"campo": "capacidad", "etiqueta": "Plazas", "formato": "numero"},
            {"campo": "autonomia", "etiqueta": "Autonomía (km)", "formato": "numero"},
            {"campo": "precio", "etiqueta": "Precio", "formato": "moneda"},
        ],
        "campos": [
            {"nombre": "nombre", "etiqueta": "Modelo", "tipo": "text", "requerido": True, "min": 3},
            {"nombre": "tipo", "etiqueta": "Tipo", "tipo": "select", "requerido": True,
             "opciones": ["Regional", "Medio alcance", "Largo alcance", "Carga"]},
            {"nombre": "capacidad", "etiqueta": "Plazas", "tipo": "number", "minimo": 0},
            {"nombre": "autonomia", "etiqueta": "Autonomía (km)", "tipo": "number", "minimo": 500},
            {"nombre": "precio", "etiqueta": "Precio (€)", "tipo": "number", "requerido": True, "minimo": 0},
        ],
    },
    "componentes": {
        "titulo": "Componentes",
        "descripcion": "Piezas en almacén. Por debajo de 50 unidades se marcan en ámbar.",
        "icono": "⚙",
        "columnas": [
            {"campo": "nombre", "etiqueta": "Componente"},
            {"campo": "tipo", "etiqueta": "Tipo", "formato": "etiqueta"},
            {"campo": "proveedor_id", "etiqueta": "Proveedor", "formato": "referencia"},
            {"campo": "stock", "etiqueta": "Stock", "formato": "stock", "sumar": True},
            {"campo": "precio", "etiqueta": "Precio unidad", "formato": "moneda"},
        ],
        "campos": [
            {"nombre": "nombre", "etiqueta": "Componente", "tipo": "text", "requerido": True, "min": 3},
            {"nombre": "tipo", "etiqueta": "Tipo", "tipo": "select", "requerido": True,
             "opciones": ["Motor", "Estructura", "Aviónica", "Mecánica", "Interior"]},
            {"nombre": "proveedor_id", "etiqueta": "Proveedor", "tipo": "referencia", "entidad": "proveedores",
             "mostrar": "nombre", "requerido": True},
            {"nombre": "stock", "etiqueta": "Stock", "tipo": "number", "requerido": True, "minimo": 0},
            {"nombre": "precio", "etiqueta": "Precio unidad (€)", "tipo": "number", "minimo": 0},
        ],
    },
    "proveedores": {
        "titulo": "Proveedores",
        "descripcion": "Empresas que suministran componentes.",
        "icono": "⛟",
        "columnas": [
            {"campo": "nombre", "etiqueta": "Proveedor"},
            {"campo": "pais", "etiqueta": "País"},
            {"campo": "especialidad", "etiqueta": "Especialidad", "formato": "etiqueta"},
            {"campo": "email", "etiqueta": "Email", "formato": "email"},
        ],
        "campos": [
            {"nombre": "nombre", "etiqueta": "Proveedor", "tipo": "text", "requerido": True, "min": 2},
            {"nombre": "pais", "etiqueta": "País", "tipo": "text", "requerido": True},
            {"nombre": "especialidad", "etiqueta": "Especialidad", "tipo": "text"},
            {"nombre": "email", "etiqueta": "Email", "tipo": "email", "requerido": True},
        ],
    },
    "empleados": {
        "titulo": "Empleados",
        "descripcion": "Plantilla de REDKYBER por departamento.",
        "icono": "☺",
        "columnas": [
            {"campo": "nombre", "etiqueta": "Nombre"},
            {"campo": "apellidos", "etiqueta": "Apellidos"},
            {"campo": "departamento", "etiqueta": "Departamento", "formato": "etiqueta"},
            {"campo": "puesto", "etiqueta": "Puesto"},
            {"campo": "salario", "etiqueta": "Salario", "formato": "moneda", "sumar": True},
        ],
        "campos": [
            {"nombre": "nombre", "etiqueta": "Nombre", "tipo": "text", "requerido": True, "min": 2},
            {"nombre": "apellidos", "etiqueta": "Apellidos", "tipo": "text", "requerido": True},
            {"nombre": "departamento", "etiqueta": "Departamento", "tipo": "select", "requerido": True,
             "opciones": ["Ingeniería", "Producción", "Calidad", "Informática", "Ventas", "Logística",
                          "Administración", "I+D"]},
            {"nombre": "puesto", "etiqueta": "Puesto", "tipo": "text"},
            {"nombre": "salario", "etiqueta": "Salario anual (€)", "tipo": "number", "minimo": 15876,
             "ayuda": "No puede ser inferior al SMI anual"},
        ],
    },
}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)

    sql = Path(sys.argv[1]).read_text(encoding="utf-8")
    esquema = Path(sys.argv[1]).with_name("schema.sql").read_text(encoding="utf-8")

    conexion = sqlite3.connect(":memory:")
    conexion.row_factory = sqlite3.Row
    conexion.executescript(esquema)
    conexion.executescript(sql)

    DESTINO.mkdir(exist_ok=True)
    for tabla, definicion in ENTIDADES.items():
        filas = [dict(f) for f in conexion.execute(f"SELECT * FROM {tabla} ORDER BY identificador")]
        salida = {"entidad": tabla, **definicion, "registros": filas}
        (DESTINO / f"{tabla}.json").write_text(
            json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{tabla}.json: {len(filas)} registros")


if __name__ == "__main__":
    main()
