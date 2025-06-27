// Lava Lamba Arka Plan Efekti
// Three.js ve React olmadan saf WebGL ile uygulanmış versiyonu

class LavaLampBackground {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'background-canvas';
        document.body.insertBefore(this.canvas, document.body.firstChild);
        
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error('WebGL desteklenmiyor!');
            return;
        }
        
        // Canvas boyutunu ayarla
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Shader programını oluştur
        this.program = this.createProgram();
        
        // Kare geometrisi oluştur (ekranı kaplayan iki üçgen)
        this.createGeometry();
        
        // Uniform değişkenleri ayarla
        this.timeLocation = this.gl.getUniformLocation(this.program, 'time');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'resolution');
        
        // Animasyonu başlat
        this.startTime = Date.now();
        this.animate();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader derleme hatası:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createProgram() {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
            attribute vec2 position;
            varying vec2 vUv;
            
            void main() {
                vUv = position * 0.5 + 0.5;
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `);
        
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
            precision highp float;
            varying vec2 vUv;
            uniform float time;
            uniform vec2 resolution;
            
            #define PI 3.14159265359
            
            // Rotasyon matrisi
            mat2 rotate2d(float angle) {
                return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            }
            
            // Yumuşak minimum fonksiyonu
            float smin(float a, float b, float k) {
                float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
                return mix(b, a, h) - k * h * (1.0 - h);
            }
            
            // Küre SDF
            float sdSphere(vec3 p, float r) {
                return length(p) - r;
            }
            
            // Sahne SDF
            float sceneSDF(vec3 p) {
                // Zamanla hareket eden küreler
                vec3 p1 = p;
                p1.xy = rotate2d(time * 0.2) * p1.xy;
                float sphere1 = sdSphere(p1 - vec3(-0.5, 0.0, 0.0), 0.35);
                
                vec3 p2 = p;
                p2.xz = rotate2d(-time * 0.2) * p2.xz;
                float sphere2 = sdSphere(p2 - vec3(0.55, 0.0, 0.0), 0.3);
                
                vec3 p3 = p;
                p3.yz = rotate2d(time * 0.3) * p3.yz;
                float sphere3 = sdSphere(p3 - vec3(-0.8, 0.0, 0.0), 0.25);
                
                vec3 p4 = p;
                p4.xy = rotate2d(-time * 0.25) * p4.xy;
                float sphere4 = sdSphere(p4 - vec3(0.0, 0.5, 0.0), 0.2);
                
                // Yumuşak birleştirme
                float result = sphere1;
                result = smin(result, sphere2, 0.5);
                result = smin(result, sphere3, 0.5);
                result = smin(result, sphere4, 0.5);
                
                return result;
            }
            
            // Normal hesaplama
            vec3 getNormal(vec3 p) {
                const float eps = 0.001;
                return normalize(vec3(
                    sceneSDF(p + vec3(eps, 0.0, 0.0)) - sceneSDF(p - vec3(eps, 0.0, 0.0)),
                    sceneSDF(p + vec3(0.0, eps, 0.0)) - sceneSDF(p - vec3(0.0, eps, 0.0)),
                    sceneSDF(p + vec3(0.0, 0.0, eps)) - sceneSDF(p - vec3(0.0, 0.0, eps))
                ));
            }
            
            // Ray marching
            float rayMarch(vec3 ro, vec3 rd) {
                float t = 0.0;
                for (int i = 0; i < 64; i++) {
                    vec3 p = ro + rd * t;
                    float d = sceneSDF(p);
                    if (d < 0.001) return t;
                    t += d * 0.5;
                    if (t > 20.0) break;
                }
                return -1.0;
            }
            
            void main() {
                // Ekran koordinatlarını normalize et
                vec2 uv = vUv;
                uv = uv * 2.0 - 1.0;
                uv.x *= resolution.x / resolution.y;
                
                // Kamera ve ışın
                vec3 ro = vec3(0.0, 0.0, 3.0);
                vec3 rd = normalize(vec3(uv, -1.5));
                
                // Gradient arka plan
                vec3 bgColor1 = vec3(0.05, 0.05, 0.1); // Koyu mavi
                vec3 bgColor2 = vec3(0.1, 0.05, 0.15); // Koyu mor
                vec3 color = mix(bgColor1, bgColor2, uv.y * 0.5 + 0.5);
                
                // Ray marching
                float t = rayMarch(ro, rd);
                if (t > 0.0) {
                    vec3 p = ro + rd * t;
                    vec3 normal = getNormal(p);
                    
                    // Basit ışıklandırma
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(normal, lightDir), 0.0);
                    
                    // Fresnel efekti
                    float fresnel = pow(1.0 - max(dot(normal, -rd), 0.0), 4.0);
                    
                    // Renk hesaplama
                    vec3 objectColor = vec3(0.8, 0.3, 0.2); // Kırmızımsı-turuncu
                    vec3 glowColor = vec3(1.0, 0.5, 0.3);   // Parlak turuncu
                    
                    color = mix(
                        objectColor * (0.2 + diff * 0.8),
                        glowColor,
                        fresnel
                    );
                    
                    // Hafif parlaklık ekle
                    color += glowColor * 0.1;
                }
                
                // Gamma düzeltme
                color = pow(color, vec3(0.4545));
                
                gl_FragColor = vec4(color, 1.0);
            }
        `);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program bağlama hatası:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }
    
    createGeometry() {
        // Pozisyon buffer'ı oluştur
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        
        // Ekranı kaplayan iki üçgen (kare)
        const positions = [
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0
        ];
        
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        // Pozisyon attribute'unu ayarla
        const positionLocation = this.gl.getAttribLocation(this.program, 'position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
    
    animate() {
        const time = (Date.now() - this.startTime) * 0.001; // saniye cinsinden
        
        // Shader programını kullan
        this.gl.useProgram(this.program);
        
        // Uniform değişkenleri güncelle
        this.gl.uniform1f(this.timeLocation, time);
        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        
        // Çiz
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        // Bir sonraki frame
        requestAnimationFrame(() => this.animate());
    }
}

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    new LavaLampBackground();
}); 