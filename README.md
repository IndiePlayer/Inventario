# Sistema de Gestión de Inventario con Control de Vencimientos

Aplicación web (100% estática, sin backend) que implementa los módulos y reglas de negocio del documento del proyecto: productos, lotes, movimientos, vencimientos, reportes y usuarios con roles. Los datos se guardan en el navegador (`localStorage`), así que no necesita servidor ni base de datos para funcionar como demo.

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@demo.com | admin123 |
| Bodeguero | bodega@demo.com | bodega123 |
| Vendedor | ventas@demo.com | ventas123 |

## Qué incluye (según el documento)

- **Login con roles**: cada rol ve solo los módulos que le corresponden.
- **Productos**: registrar, editar, consultar y eliminar (solo Administrador).
- **Lotes**: fecha de vencimiento obligatoria si el producto es perecedero.
- **Movimientos**: entrada, salida y devolución; una salida nunca deja el stock en negativo.
- **Vencimientos**: clasificación automática (vigente / próximo a vencer / vencido) con umbral configurable.
- **Reportes**: valorización del inventario e historial de movimientos por producto.
- **Usuarios**: alta y baja de usuarios (solo Administrador).

## Qué NO incluye (fuera de alcance, según el documento)

- Facturación electrónica.
- Punto de venta completo.
- Funcionamiento offline real o backend con base de datos (aquí se simula con `localStorage` para la demo).

## Cómo subirlo a GitHub y publicarlo como página

1. Crea un repositorio nuevo en GitHub (por ejemplo `inventario-vencimientos`).
2. Sube estos tres archivos a la raíz del repositorio: `index.html`, `style.css`, `app.js`.
3. Entra a **Settings → Pages** del repositorio.
4. En "Build and deployment", selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/ (root)`, luego guarda.
6. Espera uno o dos minutos: GitHub te dará un link como `https://tu-usuario.github.io/inventario-vencimientos/`.

También puedes hacerlo por terminal:

```
git init
git add index.html style.css app.js README.md
git commit -m "Sistema de inventario con control de vencimientos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

Luego activa Pages como en el paso 3.
