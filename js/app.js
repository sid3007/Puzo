window.fbxModelURL = "./assets/samba.FBX";

class App {
  constructor() {
    this.checkForXRSupport = this.checkForXRSupport.bind(this);
    this.onXRFrame = this.onXRFrame.bind(this);
    this.onEnterAR = this.onEnterAR.bind(this);
    this.onClick = this.onClick.bind(this);
    this.init();
  }

  async init() {
    this.clock = new THREE.Clock();
    if (navigator.xr && XRSession.prototype.requestHitTest) {
      try {
        this.device = await navigator.xr.requestDevice();
      } catch (e) {
        this.onNoXRDevice();
        return;
      }
    } else {
      this.onNoXRDevice();
      return;
    }
    document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
    this.group = new THREE.Group();
    DemoUtils.loadFBXModel(window.fbxModelURL).then(fbx => {
      this.mixer = new THREE.AnimationMixer(fbx);
      console.log(this.mixer);
      this.action = this.mixer.clipAction(fbx.animations[0]);
      console.log(this.action);
      this.action.play();
      this.model = fbx;
      this.model.scale.set(0.005, 0.005, 0.005);
      this.model.name = "main";
      this.group.add(this.model);
      this.model.traverse( function(node){
        if (node instanceof THREE.Mesh){
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
    });
  }

  async onEnterAR() {
    const outputCanvas = document.createElement('canvas');
    const ctx = outputCanvas.getContext('xrpresent');
    try {
      const session = await this.device.requestSession({
        outputContext: ctx,
        environmentIntegration: true,
      });
      document.body.appendChild(outputCanvas);
      this.onSessionStarted(session)
    } catch (e) {
      this.onNoXRDevice();
    }
  }

  onNoXRDevice() {
    document.body.classList.add('unsupported');
  }

  async onSessionStarted(session) {
    this.session = session;
    document.body.classList.add('ar');
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.gammaFactor = 2.2;
    this.renderer.gammaOutput = true;
    this.gl = this.renderer.getContext();
    await this.gl.setCompatibleXRDevice(this.session.device);
    this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);
    const framebuffer = this.session.baseLayer.framebuffer;
    this.renderer.setFramebuffer(framebuffer);
    this.scene = DemoUtils.createLitScene();
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
    this.reticle = new Reticle(this.session, this.camera);
    this.scene.add(this.reticle);
    this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
    this.session.requestAnimationFrame(this.onXRFrame);
    window.addEventListener('click', this.onClick);
  }

  onXRFrame(time, frame) {
    let session = frame.session;
    let pose = frame.getDevicePose(this.frameOfRef)
    this.reticle.update(this.frameOfRef);
    if (this.reticle.visible && !this.stabilized) {
      this.stabilized = true;
      document.body.classList.add('stabilized');
    }
    session.requestAnimationFrame(this.onXRFrame);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);
    if(pose){
      for (let view of frame.views) {
        const viewport = session.baseLayer.getViewport(view);
        this.viewport = viewport;
        this.renderer.setSize(viewport.width, viewport.height);
        this.camera.projectionMatrix.fromArray(view.projectionMatrix);
        const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
        this.camera.matrix.getInverse(viewMatrix);
        this.camera.updateMatrixWorld(true);
        this.renderer.clearDepth();
      }
      this.delta = this.clock.getDelta();
      if(this.mixer){
        this.mixer.update(this.delta);
      }
      this.renderer.render(this.scene, this.camera);
    }
  }

  async checkForXRSupport(){
    navigator.xr.supportsSessionMode('immersive-ar').then(() => {
      console.log("XR is supported")
    }).catch((reason) => {
      console.log("Session not supported: " + reason);
    });
  }

  async onClick(e) {
    const x = 0;
    const y = 0;
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const ray = this.raycaster.ray;
    const origin = new Float32Array(ray.origin.toArray());
    const direction = new Float32Array(ray.direction.toArray());
    const hits = await this.session.requestHitTest(origin, direction, this.frameOfRef);
    if (hits.length) {
      const hit = hits[0];
      const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);
      this.model.name = "main";
      const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
      shadowMesh.position.y = this.model.position.y;
      if(!window.app.scene.getObjectByName( "main" )){
        this.group.position.setFromMatrixPosition(hitMatrix);
        this.scene.add(this.group);
        this.modelLoaded = true;
        DemoUtils.lookAtOnY(this.group, this.camera);
        this.group.position.y = -1.55;
        this.reticle.ring.visible = false;
        this.reticle.icon.visible = false;
        console.log(this.reticle);
      }
      else {
        console.log("model is present");
        this.model.position.setFromMatrixPosition(hitMatrix);
      }
    }
  }
};

window.app = new App();