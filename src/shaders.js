import * as THREE from 'three';

/**
 * GLSL Shaders for Background Deep Navy Gradient with Procedural Noise Layer
 */
export const BackgroundShader = {
  uniforms: {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMouseVelocity: { value: 0 },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    uniform float uMouseVelocity;
    varying vec2 vUv;

    // Simplex 2D noise implementation
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Fractal Brownian Motion (FBM) for realistic nebula haze
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 0.0;
      for (int i = 0; i < 4; i++) {
        value += amplitude * snoise(st);
        st *= 2.1;
        amplitude *= 0.5;
      }
      return value;
    }

    // Subtle grain texture overlay
    float randomGrain(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 st = gl_FragCoord.xy / uResolution.xy;
      vec2 aspectSt = vec2(st.x * (uResolution.x / uResolution.y), st.y);
      
      // Deep Navy Color Palette Stops
      vec3 deepNavy   = vec3(0.015, 0.031, 0.078); // Very dark cosmic navy
      vec3 midIndigo  = vec3(0.043, 0.086, 0.188); // Mid indigo blue
      vec3 royalNavy  = vec3(0.082, 0.137, 0.294); // Luminous deep navy
      vec3 cyanNebula = vec3(0.051, 0.216, 0.380); // Cyan/Teal accent highlight
      vec3 violetGlow = vec3(0.180, 0.118, 0.322); // Subtle violet depth

      // Base Radial Gradient from Center
      vec2 center = vec2(0.5, 0.5);
      float distFromCenter = length(st - center);
      vec3 baseGradient = mix(midIndigo, deepNavy, smoothstep(0.1, 0.95, distFromCenter));

      // Organic Noise Turbulence
      vec2 noiseCoord = aspectSt * 1.5;
      float n1 = fbm(noiseCoord + vec2(uTime * 0.03, uTime * 0.02));
      float n2 = fbm(noiseCoord * 2.0 - vec2(uTime * 0.02, -uTime * 0.03));

      // Blend Noise Haze into Navy Gradient
      vec3 color = baseGradient;
      color = mix(color, royalNavy, clamp(n1 * 0.6, 0.0, 1.0));
      color = mix(color, cyanNebula, clamp(n2 * 0.35, 0.0, 0.8) * (1.0 - distFromCenter));

      // Dynamic Visitor Mouse Aura Reaction
      float mouseDist = length(st - uMouse);
      float mouseAura = smoothstep(0.18, 0.0, mouseDist);
      vec3 mouseColor = mix(vec3(0.25, 0.3, 0.42), vec3(0.35, 0.4, 0.52), 0.5 + 0.5 * sin(uTime));
      
      // Add visitor aura glow with velocity boost
      color += mouseColor * mouseAura * (0.35 + clamp(uMouseVelocity * 2.0, 0.0, 0.4));

      // Subtle Analog Grain Texture (Noise Layer)
      float grain = (randomGrain(st * 100.0 + fract(uTime)) - 0.5) * 0.035;
      color += vec3(grain);

      // Vignette to frame the media art
      float vignette = smoothstep(1.2, 0.3, length(st - vec2(0.5)));
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

/**
 * GLSL Shaders for Luminous Glowing Particles
 */
export const ParticleShader = {
  uniforms: {
    uTime: { value: 0 },
    uGlowIntensity: { value: 0.65 },
    uMousePos: { value: new THREE.Vector3(0, 0, 0) },
  },

  vertexShader: `
    attribute float aScale;
    attribute float aAlpha;
    attribute vec3 aColor;
    attribute float aSpeed;
    attribute float aPhase;

    uniform float uTime;
    uniform float uGlowIntensity;
    uniform vec3 uMousePos;

    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistToMouse;

    void main() {
      vColor = aColor;
      
      // Floating wave animation
      vec3 pos = position;
      float wave = sin(uTime * aSpeed + aPhase) * 0.12;
      pos.y += wave;
      pos.x += cos(uTime * aSpeed * 0.7 + aPhase) * 0.08;

      // Distance to visitor pointer
      float dist = distance(pos, uMousePos);
      vDistToMouse = dist;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Attenuated Size with distance to camera and visitor interaction boost
      float sizeBoost = smoothstep(1.5, 0.0, dist) * 6.0;
      gl_PointSize = (aScale * uGlowIntensity * 1.1 + sizeBoost) * (290.0 / -mvPosition.z);
      
      vAlpha = aAlpha * (0.75 + 0.25 * sin(uTime * aSpeed * 2.0 + aPhase));
    }
  `,

  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vDistToMouse;

    void main() {
      // Create radial glowing disc with soft gaussian edge
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      
      if (dist > 0.5) discard;

      // Soft halo and intense sharp core
      float glow = exp(-dist * dist * 16.0);
      float core = exp(-dist * dist * 60.0) * 1.0;

      // Color glow modulation
      vec3 finalColor = vColor + vec3(core * 0.25);
      
      // Additional brightness when near cursor
      float mouseHighlight = smoothstep(1.2, 0.0, vDistToMouse);
      finalColor += vec3(0.18, 0.18, 0.22) * mouseHighlight;

      gl_FragColor = vec4(finalColor, (glow * 0.75 + core * 0.85) * vAlpha);
    }
  `
};
