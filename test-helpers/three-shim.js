// Stand-in for the page's "three" import. It is the REAL Three.js (maths, camera, raycaster)
// with one change: WebGLRenderer, which needs a graphics card, is replaced by a stand-in
// that owns a fake canvas and draws nothing.
export * from '../docs/vendor/three.module.js';
export class WebGLRenderer {
  constructor() {
    const page = globalThis.__fakePage;
    if (page.failRenderer) throw new Error('WebGL is not available');
    this.domElement = page.makeCanvas();
  }
  setSize() {}
  // The real renderer also brings every object's position up to date before drawing; the picking code relies on that.
  render(scene) { scene.updateMatrixWorld(); globalThis.__fakePage.renders += 1; }
}
