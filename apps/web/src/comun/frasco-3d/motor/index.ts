// Entrada diferida del frasco 3D: solo la carga `import('./motor')`, así three
// va en su propio chunk y no engorda el primer pintado.
export { crearFrasco3D } from '../frasco-3d';
