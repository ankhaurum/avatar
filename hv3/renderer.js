// PixiJS renderer for the Hibiki rig. Every part is a textured Mesh whose
// vertex buffer is rewritten each frame from RigModel. Following the earlier V3
// WebGL2 renderer, textures are premultiplied and stencil masks are drawn with
// a discard threshold so a clip follows the mask's opaque pixels rather than
// its triangles.
import { Application, Container, Mesh, MeshGeometry, Shader, UniformGroup, Assets } from './vendor/pixi.min.mjs';

const vertex = `in vec2 aPosition;in vec2 aUV;out vec2 vUV;
uniform mat3 uProjectionMatrix;uniform mat3 uWorldTransformMatrix;uniform mat3 uTransformMatrix;
void main(){mat3 m=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix;gl_Position=vec4((m*vec3(aPosition,1.0)).xy,0.0,1.0);vUV=aUV;}`;
const fragment = `in vec2 vUV;uniform sampler2D uTexture;uniform float uAlpha;uniform float uCut;out vec4 finalColor;
void main(){vec4 c=texture(uTexture,vUV);if(c.a<uCut)discard;finalColor=c*uAlpha;}`;

export const VIEWS = {
  bust: [236, 0, 552, 640],
  face: [432, 56, 160, 190],
  full: [120, 0, 784, 1536]
};

export class AvatarRenderer {
  async init(host, model, baseURL) {
    this.model = model;
    this.app = new Application();
    await this.app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl' });
    host.appendChild(this.app.canvas);
    this.root = new Container();
    this.root.sortableChildren = true;
    this.app.stage.addChild(this.root);
    const files = [...new Set(model.parts.map(p => p.texture))];
    const textures = new Map();
    // mipmaps with trilinear filtering keep edges smooth when parts are shown smaller than their texture
    await Promise.all(files.map(async f => {
      const tex = await Assets.load({ src: new URL('parts/' + f, baseURL).href, data: { autoGenerateMipmaps: true } });
      tex.source.style.mipmapFilter = 'linear';
      tex.source.style.maxAnisotropy = 4;
      tex.source.updateMipmaps();
      textures.set(f, tex);
    }));
    this.items = [];
    const byId = new Map(), maskGroups = new Map();
    const make = (p, cut) => {
      const geometry = new MeshGeometry({ positions: Float32Array.from(p.rest), uvs: Float32Array.from(p.mesh.uvs), indices: new Uint32Array(p.mesh.triangles) });
      const uniforms = new UniformGroup({ uAlpha: { value: 1, type: 'f32' }, uCut: { value: cut, type: 'f32' } });
      const shader = Shader.from({ gl: { vertex, fragment }, resources: { uTexture: textures.get(p.texture).source, u: uniforms } });
      const mesh = new Mesh({ geometry, shader });
      return { part: p, mesh, uniforms, buffer: geometry.getBuffer('aPosition') };
    };
    const ordered = [...model.parts].sort((a, b) => a.order - b.order);
    for (const p of ordered) if (p.maskOnly) { const it = make(p, 0.5); byId.set(p.id, it); this.items.push(it); this.root.addChild(it.mesh); }
    for (const p of ordered) {
      if (p.maskOnly) continue;
      const it = make(p, 0.004);
      byId.set(p.id, it);
      this.items.push(it);
      if (p.mask) {
        let group = maskGroups.get(p.mask);
        if (!group) { group = new Container(); group.mask = byId.get(p.mask).mesh; group.zIndex = p.order; maskGroups.set(p.mask, group); this.root.addChild(group); }
        group.addChild(it.mesh);
      } else { it.mesh.zIndex = p.order; it.top = true; this.root.addChild(it.mesh); }
    }
    this.setView('bust');
    this.app.renderer.on('resize', () => this.layout());
    // the host box can change size without a window resize (placement on the page)
    new ResizeObserver(() => this.app.resize()).observe(host);
    return this;
  }
  setView(name) { this.viewName = typeof name === 'string' ? name : ''; this.view = (this.model.json.views || VIEWS)[name] || name; this.layout(); }
  layout() {
    const [x, y, w, h] = this.view, W = this.app.screen.width, H = this.app.screen.height;
    // the face (art A, 1 texture px per unit) is never shown above ~2x
    // bust-up keeps its framing (head to below the chest) in a narrow box: the
    // sides (the outer arms) may be cut, down to the head and shoulders
    const core = this.viewName === 'bust' ? 0.64 : 1;
    const s = Math.min(W / (w * core), H / h, (this.model.json.views ? 2 : 3.6) / this.app.renderer.resolution);
    this.root.scale.set(s);
    this.root.position.set((W - w * s) / 2 - x * s, (H - h * s) / 2 - y * s);
  }
  sync() {
    for (const it of this.items) {
      it.buffer.data.set(it.part.positions);
      it.buffer.update();
      it.uniforms.uniforms.uAlpha = it.part.opacity;
      it.mesh.visible = it.part.opacity > 0.002 || it.part.maskOnly;
      if (it.top && it.mesh.zIndex !== it.part.drawOrder) it.mesh.zIndex = it.part.drawOrder;
    }
  }
}
