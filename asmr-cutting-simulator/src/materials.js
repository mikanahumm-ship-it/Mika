import * as THREE from 'three';

// Volumetric procedural materials. Colour is evaluated from the material-space
// position of each fragment, so every new cut face reveals the "inside" of the
// object consistently (marbling, layers, fruit flesh, crumb ...).

export const PAT = {
  solid: 0, meat: 1, layers: 2, swirl: 3, speckle: 4, radial: 5, crumb: 6,
  grain: 7, stripes: 8, rainbow: 9, rings: 10, grady: 11, citrus: 12, dots: 13,
  angular: 14,
};

const NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5;} return s; }
vec3 hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
`;

const PATTERN = /* glsl */`
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform float uS; uniform vec4 uP; uniform vec3 uAxis; uniform vec3 uCenter;
varying vec3 vMPos; varying vec3 vMNrm;
${NOISE}
float axr(vec3 p){ vec3 q=p-uCenter; if (dot(uAxis,uAxis)<.5) return length(q); return length(q - dot(q,uAxis)*uAxis); }
vec3 patColor(vec3 p){
  vec3 col = uC1;
#if PAT == 0
  col = mix(uC1, uC2, smoothstep(.25,.85,fbm(p*uS)));
#elif PAT == 1
  float b = fbm(p*uS*.6);
  col = mix(uC1, uC2, smoothstep(.3,.8,b));
  float v = abs(fbm(p*uS*vec3(1.,1.6,1.)+3.1)-.5);
  float fat = 1.-smoothstep(uP.x*.5, uP.x, v);
  float blob = smoothstep(.62,.7,fbm(p*uS*.9+7.));
  col = mix(col, uC3, max(fat, blob*uP.y));
#elif PAT == 2
  float t = (p.y - uP.y)*uS + (fbm(p*3.)-.5)*uP.x;
  float n = max(uP.z, 1.);
  float k = mod(floor(t), n);
  float e = fract(t);
  vec3 a = k<.5?uC1: k<1.5?uC2: k<2.5?uC3:uC4;
  float kk = mod(k+1., n);
  vec3 bcol = kk<.5?uC1: kk<1.5?uC2: kk<2.5?uC3:uC4;
  col = mix(a, bcol, smoothstep(1.-uP.w, 1., e));
  col *= .94 + .12*fbm(p*14.);
#elif PAT == 3
  float s = sin(dot(p, vec3(1.,.6,.8))*uS + fbm(p*1.7)*uP.x);
  col = mix(uC1, uC2, smoothstep(-.2,.2,s));
  float s2 = abs(sin(dot(p, vec3(.3,1.,.5))*uS*1.7 + fbm(p*2.3+4.)*uP.x));
  col = mix(col, uC3, (1.-smoothstep(0.,.08,s2))*uP.y);
#elif PAT == 4
  col = mix(uC1, uC2, smoothstep(.3,.8,fbm(p*uS*.5)));
  float d = vnoise(p*uS*3.);
  col = mix(col, uC3, smoothstep(uP.x, uP.x+.04, d)*uP.y);
#elif PAT == 5
  // radial: skin (C1) > pith (C2) > flesh (C3) > core (C4); optional seeds when uS>=.5
  float r = axr(p)/uP.w;
  r += (fbm(p*6.)-.5)*.04;
  col = r > uP.x ? uC1 : r > uP.y ? uC2 : r > uP.z ? uC3 : uC4;
  if (r <= uP.y && r > uP.z) col = mix(col, uC2, smoothstep(uP.y-.08, uP.y, r)*.5);
  if (uS >= .5) {
    vec3 q = p*vec3(16.,11.,16.); vec3 c = floor(q); vec3 f = fract(q)-.5;
    vec3 o = vec3(h31(c), h31(c+3.), h31(c+7.))-.5;
    float d = length((f - o*.6)*vec3(1.,.6,1.));
    bool ring = uP.z > 0. ? (r > uP.z && r < uP.z + .16) : (r > .35 && r < .78);
    if (ring && h31(c+13.) > .35) col = mix(col, vec3(.1,.07,.05), 1.-smoothstep(.13,.17,d));
  }
  col *= .94 + .1*fbm(p*20.);
#elif PAT == 6
  col = mix(uC1, uC2, fbm(p*uS*.3));
  float hole = vnoise(p*uS*2.) * vnoise(p*uS*4.7+3.);
  col = mix(col, uC3, smoothstep(uP.x, uP.x+.08, hole));
#elif PAT == 7
  float g = h31(floor(p*uS*30.));
  col = mix(uC1, uC2, g);
  col = mix(col, uC3, step(.97, h31(floor(p*uS*30.)+5.))*uP.x);
  col *= .9 + .2*fbm(p*4.);
#elif PAT == 8
  float s = sin((p.x*.8 + p.y*.5 + p.z*.2)*uS + fbm(p*2.)*2.5);
  col = mix(uC1, uC2, smoothstep(.2,.5,fbm(p*3.)));
  col = mix(col, uC3, smoothstep(1.-uP.x, 1., s));
#elif PAT == 9
  float hh = dot(p, vec3(1.,.35,.2))*uS + fbm(p*2.)*.3;
  col = hsv2rgb(vec3(fract(hh), uP.x, uP.y));
#elif PAT == 10
  float r = axr(p);
  float t = fract(r*uS + fbm(p*2.)*uP.x);
  col = mix(uC1, uC2, smoothstep(.4,.55,t)*(1.-smoothstep(.85,1.,t)));
#elif PAT == 11
  float t = smoothstep(uP.x, uP.y, p.y + (fbm(p*3.)-.5)*uP.z);
  col = mix(uC1, uC2, t);
#elif PAT == 12
  vec3 q = p-uCenter; float r = axr(p)/uP.w;
  vec3 a1 = normalize(cross(uAxis, abs(uAxis.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.))); vec3 a2 = cross(uAxis,a1);
  float ang = atan(dot(q,a2), dot(q,a1));
  float seg = abs(fract(ang/6.2831*uS)-.5);
  col = r > uP.x ? uC1 : r > uP.y ? uC2 : mix(uC4*.9, uC4*1.05, fbm(p*30.));
  if (r <= uP.y) col = mix(col, uC3, max(smoothstep(.45,.49,seg), 1.-smoothstep(0.,.07,r)));
#elif PAT == 13
  vec3 c = floor(p*uS); vec3 f = fract(p*uS)-.5;
  vec3 o = vec3(h31(c), h31(c+3.), h31(c+7.))-.5;
  float d = length(f - o*.5);
  float pick = h31(c+11.);
  vec3 dc = pick<.33?uC2: pick<.66?uC3:uC4;
  col = mix(uC1*(.95+.1*fbm(p*5.)), dc, 1.-smoothstep(uP.x, uP.x+.03, d));
#elif PAT == 14
  vec3 q = p-uCenter;
  float ang = atan(q.z, q.y);
  float s = sin(ang*uS + fbm(p*2.)*2.);
  col = mix(uC1, uC2, smoothstep(-uP.x, uP.x, s));
  col *= .92 + .14*fbm(p*8.);
#endif
  return col;
}
`;

const cache = new Map();
function key(spec) { return 'asmr_' + spec.pat; }

// Make a material for one surface (outer or inner) of an object definition.
// Each cluster mesh gets its own clone so wobble uniforms are per piece.
export function makeMaterial(surf, matProps, shared, opts = {}) {
  const base = {
    color: 0xffffff,
    roughness: surf.rough ?? matProps.rough ?? 0.6,
    metalness: 0,
    side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
  };
  let m;
  const physical = matProps.clearcoat || matProps.sheen || matProps.opacity < 1;
  if (physical) {
    m = new THREE.MeshPhysicalMaterial({
      ...base,
      clearcoat: matProps.clearcoat || 0,
      clearcoatRoughness: 0.15,
      sheen: matProps.sheen || 0,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(1, 1, 1),
      transparent: (matProps.opacity ?? 1) < 1,
      opacity: matProps.opacity ?? 1,
      ior: 1.4,
      specularIntensity: matProps.spec ?? 0.6,
    });
  } else {
    m = new THREE.MeshStandardMaterial(base);
  }
  if (surf.emissive) { m.emissive = new THREE.Color(surf.emissive); m.emissiveIntensity = surf.emissiveI ?? 0.25; }
  const u = {
    uC1: { value: new THREE.Color(surf.c[0]) },
    uC2: { value: new THREE.Color(surf.c[1] ?? surf.c[0]) },
    uC3: { value: new THREE.Color(surf.c[2] ?? surf.c[1] ?? surf.c[0]) },
    uC4: { value: new THREE.Color(surf.c[3] ?? surf.c[2] ?? surf.c[0]) },
    uS: { value: surf.s ?? 4 },
    uP: { value: new THREE.Vector4(...(surf.p || [0.1, 0.5, 3, 0.15])) },
    uAxis: { value: new THREE.Vector3(...(surf.axis || [0, 1, 0])).normalize() },
    uCenter: { value: new THREE.Vector3(...(surf.center || [0, 0, 0])) },
    uWobA: shared.wob,          // per-cluster {value}
    uWobT: shared.time,         // global time
    uWobBase: shared.base,      // per-cluster base y
    uWobH: shared.height,
    uPress: shared.press || { value: new THREE.Vector4(0, 0, 0, 1) },
    uPressH: shared.pressH || { value: 0 },
    uPressU: shared.pressU || { value: new THREE.Vector3(0, 1, 0) },
    uPressBase: shared.pressBase || { value: 0 },
    uPressBulge: shared.pressBulge || { value: 0.6 },
  };
  if (opts.double) m.shadowSide = THREE.FrontSide; // thin double-sided strips: avoid self-shadow acne
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.defines = sh.defines || {};
    sh.defines.PAT = surf.pat;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMPos; varying vec3 vMNrm;
        ${opts.mpos ? 'attribute vec3 mpos;' : ''}
        uniform float uWobA; uniform float uWobT; uniform float uWobBase; uniform float uWobH;
        uniform vec4 uPress; uniform float uPressH; uniform vec3 uPressU; uniform float uPressBase; uniform float uPressBulge;
        // Squish: a finger dent with a soft bulge/ridge around it. Mirrors pressD() in squish.js.
        vec3 pressD(vec3 p) {
          vec3 u = uPressU, c = uPress.xyz; float R = uPress.w;
          float hp = dot(p, u) - uPressBase, hc = max(dot(c, u) - uPressBase, 0.02);
          vec3 q = (p - c) - dot(p - c, u) * u; float r = length(q), x = r / R;
          float f = clamp(hp / hc, 0., 1.);
          float w = exp(-x * x * 1.6);
          vec3 dir = r > 1e-5 ? q / r : vec3(0.);
          float bul = uPressH * uPressBulge * x * exp(-x * x * 0.9) * f * (1. - 0.5 * f);
          float ridge = uPressH * uPressBulge * 0.45 * exp(-pow((x - 1.35) * 2.2, 2.)) * f;
          return dir * bul + u * (-uPressH * w * f + ridge);
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        if (uPressH > 0.0005) {
          const float e = 0.01;
          vec3 gx = (pressD(position + vec3(e,0.,0.)) - pressD(position - vec3(e,0.,0.))) / (2. * e);
          vec3 gy = (pressD(position + vec3(0.,e,0.)) - pressD(position - vec3(0.,e,0.))) / (2. * e);
          vec3 gz = (pressD(position + vec3(0.,0.,e)) - pressD(position - vec3(0.,0.,e))) / (2. * e);
          objectNormal = normalize(objectNormal - vec3(dot(gx, objectNormal), dot(gy, objectNormal), dot(gz, objectNormal)));
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMPos = ${opts.mpos ? 'mpos' : 'position'}; vMNrm = normal;
        if (uPressH > 0.0005) transformed += pressD(position);
        if (uWobA > 0.0001) {
          float hh = clamp((position.y - uWobBase) / max(uWobH, .01), 0., 1.);
          float w = sin(uWobT*21.) * uWobA * hh;
          transformed.x += w * (1.0 + position.z*.3);
          transformed.z += sin(uWobT*17.+1.3) * uWobA * hh * .7;
          transformed.y *= 1.0 - cos(uWobT*24.)*uWobA*.35*hh;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PATTERN)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= patColor(vMPos);`);
  };
  m.customProgramCacheKey = () => key(surf) + (physical ? 'p' : 's') + (surf.emissive ? 'e' : '') + (opts.mpos ? 'm' : '');
  return m;
}

// CPU approximation of a surface colour (for particles / thumbnails UI accents)
export function surfColor(surf, mix = Math.random()) {
  const a = new THREE.Color(surf.c[0]), b = new THREE.Color(surf.c[1] ?? surf.c[0]);
  if (surf.pat === PAT.rainbow) return new THREE.Color().setHSL(Math.random(), 0.55, 0.72);
  return a.lerp(b, mix);
}
