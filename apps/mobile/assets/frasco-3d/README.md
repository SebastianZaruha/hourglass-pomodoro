# Frasco 3D (modelo para Android)

`frasco.glb` es el mismo frasco que pinta la web (`apps/web/src/comun/frasco-3d`), hito 2 de Picasso.

- Alto 0,22 m, **origen en el cuello**, Y hacia arriba. La web solo exige que se respeten el origen en el cuello y la proporción de la foto (446×1024).
- Material PBR con transmission, volume e ior (KHR_materials_*), que leen Blender y Filament/SceneView.
- **Sin coordenadas de textura (UV):** el vidrio no lleva texturas. Si algún día hace falta texturizarlo, hay que volver a exportarlo con UV.
- Sale del perfil `perfil-datos.ts` con `exportarGLB()` (`apps/web/src/comun/frasco-3d/exportar-gltf.ts`).
- Aún sin comprimir (1,6 MB, un 18 % menos que el del hito 1). Pendiente: refinarlo en Blender y comprimirlo (meshopt o Draco) por debajo de 200 KB.

La app móvil todavía no lo usa: no está referenciado, así que no entra en el APK.
