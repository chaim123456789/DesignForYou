// The REAL OrbitControls, with one addition: the test can find the controls it made.
import { OrbitControls as RealOrbitControls } from '../docs/vendor/OrbitControls.js';
export class OrbitControls extends RealOrbitControls {
  constructor(...args) {
    super(...args);
    globalThis.__fakePage.controls = this;
  }
}
