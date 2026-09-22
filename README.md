# Sistema de Gestión de Inventario con Control de Vencimientos

Aplicación web  que implementa los módulos y reglas de negocio del documento del proyecto: productos, lotes, movimientos, vencimientos, reportes y usuarios con roles. Los datos se guardan en el navegador (`localStorage`), así que no necesita servidor ni base de datos para funcionar como demo.

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@demo.com | admin123 |
| Bodeguero | bodega@demo.com | bodega123 |
| Vendedor | ventas@demo.com | ventas123 |

## Qué incluye

- **Login con roles**: cada rol ve solo los módulos que le corresponden.
- **Productos**: registrar, editar, consultar y eliminar (solo Administrador).
- **Lotes**: fecha de vencimiento obligatoria si el producto es perecedero.
- **Movimientos**: entrada, salida y devolución; una salida nunca deja el stock en negativo.
- **Vencimientos**: clasificación automática (vigente / próximo a vencer / vencido) con umbral configurable.
- **Reportes**: valorización del inventario e historial de movimientos por producto.
- **Usuarios**: alta y baja de usuarios (solo Administrador).

## Qué NO incluye 

- Facturación electrónica.
- Punto de venta completo.
- Funcionamiento offline real o backend con base de datos (aquí se simula con `localStorage` para la demo).
