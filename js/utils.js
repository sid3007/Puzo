/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// remaps opacity from 0 to 1
const opacityRemap = mat => {
  if (mat.opacity === 0) {
    mat.opacity = 1;
  }
};

/**
 * The Reticle class creates an object that repeatedly calls
 * `xrSession.requestHitTest()` to render a ring along a found
 * horizontal surface.
 */ 
class Reticle extends THREE.Object3D {
  /**
   * @param {XRSession} xrSession
   * @param {THREE.Camera} camera
   */
  constructor(xrSession, camera) {
    super();

    this.loader = new THREE.TextureLoader();

    let geometry = new THREE.RingGeometry(0.1, 0.11, 96, 24);
    //let geometry = new THREE.BoxGeometry(0.3366,0.1544, 0.01, 10, 10, 10);
    let material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // Orient the geometry so its position is flat on a horizontal surface
    geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));

    this.ring = new THREE.Mesh(geometry, material);
    //this.box = new THREE.Mesh(geometry, material);
    geometry = new THREE.PlaneBufferGeometry(0.15, 0.15);
    // Orient the geometry so its position is flat on a horizontal surface,
    // as well as rotate the image so the anchor is facing the user
    geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));
    geometry.applyMatrix(new THREE.Matrix4().makeRotationY(THREE.Math.degToRad(0)));
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0
    });
    this.icon = new THREE.Mesh(geometry, material);

    // Load the anchor texture and apply it to our material
    // once loaded
      //this.loader.load('../assets/Anchor.png', texture => {
      this.loader.load('../assets/CrossHair.png', texture => {
      this.icon.material.opacity = 1;
      this.icon.material.map = texture;
    });

    this.add(this.ring);
    //this.add(this.box);
    this.add(this.icon);

    this.session = xrSession;
    this.visible = false;
    this.camera = camera;
  }

  /**
   * Fires a hit test in the middle of the screen and places the reticle
   * upon the surface if found.
   *
   * @param {XRCoordinateSystem} frameOfRef
   */
  async update(frameOfRef) {
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const ray = this.raycaster.ray;

    const origin = new Float32Array(ray.origin.toArray());
    const direction = new Float32Array(ray.direction.toArray());
    const hits = await this.session.requestHitTest(origin,
                                                   direction,
                                                   frameOfRef);

    if (hits.length) {
      const hit = hits[0];
      // console.log(hit);
      const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

      // Now apply the position from the hitMatrix onto our model
      this.position.setFromMatrixPosition(hitMatrix);
  
      DemoUtils.lookAtOnY(this, this.camera);

      this.visible = true;
    }
  }
}

window.DemoUtils = {
  /**
   * Creates a THREE.Scene containing lights that case shadows,
   * and a mesh that will receive shadows.
   *
   * @return {THREE.Scene}
   */
  createLitScene() {
    const scene = new THREE.Scene();

    // The materials will render as a black mesh
    // without lights in our scenes. Let's add an ambient light
    // so our material can be visible, as well as a directional light
    // for the shadow.
    const light = new THREE.AmbientLight(0xffffff, 1);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);

    // We want this light to cast shadow.
    directionalLight.castShadow = true;

    // Make a large plane to receive our shadows
    const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
    // Rotate our plane to be parallel to the floor
    planeGeometry.rotateX(-Math.PI / 2);

    // Create a mesh with a shadow material, resulting in a mesh
    // that only renders shadows once we flip the `receiveShadow` property.
    const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
      color: 0x111111,
      opacity: 0.2,
    }));

    // Give it a name so we can reference it later, and set `receiveShadow`
    // to true so that it can render our model's shadow.
    shadowMesh.name = 'shadowMesh';
    shadowMesh.receiveShadow = true;
    shadowMesh.position.y = 10000;

    // Add lights and shadow material to scene.
    scene.add(shadowMesh);
    scene.add(light);
    scene.add(directionalLight);

    return scene;
  },

  /**
   * Creates a THREE.Scene containing cubes all over the scene.
   *
   * @return {THREE.Scene}
   */
  createCubeScene() {
    const scene = new THREE.Scene();

    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      new THREE.MeshBasicMaterial({ color: 0x0000ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      new THREE.MeshBasicMaterial({ color: 0xff00ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ffff }),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    ];

    const ROW_COUNT = 4;
    const SPREAD = 1;
    const HALF = ROW_COUNT / 2;
    for (let i = 0; i < ROW_COUNT; i++) {
      for (let j = 0; j < ROW_COUNT; j++) {
        for (let k = 0; k < ROW_COUNT; k++) {
          const box = new THREE.Mesh(new THREE.BoxBufferGeometry(0.2, 0.2, 0.2), materials);
          box.position.set(i - HALF, j - HALF, k - HALF);
          box.position.multiplyScalar(SPREAD);
          scene.add(box);
        }
      }
    }

    return scene;
  },

  /**
   * Loads an OBJ model with an MTL material applied.
   * Returns a THREE.Group object containing the mesh.
   *
   * @param {string} objURL
   * @param {string} mtlURL
   * @return {Promise<THREE.Group>}
   */
  loadModel(objURL, mtlURL) {
    // OBJLoader and MTLLoader are not a part of three.js core, and
    // must be included as separate scripts.
    const objLoader = new THREE.OBJLoader();
    const mtlLoader = new THREE.MTLLoader();

    // Set texture path so that the loader knows where to find
    // linked resources
    mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

    // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from
    // Poly benefit due to how they were encoded.
    mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true });

    // OBJLoader and MTLLoader provide callback interfaces; let's
    // return a Promise and resolve or reject based off of the asset
    // downloading.
    return new Promise((resolve, reject) => {
      mtlLoader.load(mtlURL, materialCreator => {
        // We have our material package parsed from the .mtl file.
        // Be sure to preload it.
        materialCreator.preload();

        // Remap opacity values in the material to 1 if they're set as
        // 0; this is another peculiarity of Poly models and some
        // MTL materials.
        for (let material of Object.values(materialCreator.materials)) {
          opacityRemap(material);
        }

        // Give our OBJ loader our materials to apply it properly to the model
        objLoader.setMaterials(materialCreator);

        // Finally load our OBJ, and resolve the promise once found.
        objLoader.load(objURL, resolve, function(progress){console.log(progress)}, reject);
      }, function(){}, reject);
    });
    
  },


  /**
   * Loads an OBJ model with an MTL material applied.
   * Returns a THREE.Group object containing the mesh.
   *
   * @param {string} objURL
   * @param {string} mtlURL
   * @return {Promise<THREE.Group>}
   */
  loadGLTFModel(modelURL) {
    // OBJLoader and MTLLoader are not a part of three.js core, and
    // must be included as separate scripts.
    // const objLoader = new THREE.OBJLoader();
    // const mtlLoader = new THREE.MTLLoader();

    //GLTF Loader 
    // Instantiate a loader
    var loader = new THREE.GLTFLoader();
    console.log(THREE);
    console.log(THREE.DRACOLoader);
    // Optional: Provide a DRACOLoader instance to decode compressed mesh data
    // THREE.DRACOLoader.setDecoderPath( 'third_party/draco' );
    // loader.setDRACOLoader( new THREE.DRACOLoader() );


    // Set texture path so that the loader knows where to find
    // linked resources
    // mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

    // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from
    // Poly benefit due to how they were encoded.
    // mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true });

    // OBJLoader and MTLLoader provide callback interfaces; let's
    // return a Promise and resolve or reject based off of the asset
    // downloading.
    return new Promise((resolve, reject) => {
      // mtlLoader.load(mtlURL, materialCreator => {
      //   // We have our material package parsed from the .mtl file.
      //   // Be sure to preload it.
      //   materialCreator.preload();

      //   // Remap opacity values in the material to 1 if they're set as
      //   // 0; this is another peculiarity of Poly models and some
      //   // MTL materials.
      //   for (let material of Object.values(materialCreator.materials)) {
      //     opacityRemap(material);
      //   }

      //   // Give our OBJ loader our materials to apply it properly to the model
      //   objLoader.setMaterials(materialCreator);

      //   // Finally load our OBJ, and resolve the promise once found.
      //   objLoader.load(objURL, resolve, function(progress){console.log(progress)}, reject);
      // }, function(){}, reject);

      // GLTF CUSTOM CODE
      // Load a glTF resource
      loader.load(
        // resource URL
        modelURL,
        // called when the resource is loaded
        resolve,
        // function ( gltf ) {

        //   // window.app.scene.add( gltf.scene );

        //   gltf.animations; // Array<THREE.AnimationClip>
        //   gltf.scene; // THREE.Scene
        //   gltf.scenes; // Array<THREE.Scene>
        //   gltf.cameras; // Array<THREE.Camera>
        //   gltf.asset; // Object

        // //  resolve(gltf);


        // },
        // called while loading is progressing
        function ( xhr ) {

          console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        },
        // called when loading has errors
        reject
        // function ( error ) {

        //   console.log( 'An error happened' );

        // }
      );

    });

    

  },


  loadFBXModel(fbxURL) {
    // OBJLoader and MTLLoader are not a part of three.js core, and
    // must be included as separate scripts.
    const fbxLoader = new THREE.FBXLoader();
    return new Promise((resolve, reject) => {
      fbxLoader.load(
        // resource URL
        fbxURL,
        // called when the resource is loaded
        resolve,
        // called while loading is progressing
        function ( xhr ) {
          console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        reject
      );
    });
  },



  /**
   * Similar to THREE.Object3D's `lookAt` function, except we only
   * want to rotate on the Y axis. In our AR use case, we don't want
   * our model rotating in all axes, instead just on the Y.
   *
   * @param {THREE.Object3D} looker
   * @param {THREE.Object3D} target
   */
  lookAtOnY(looker, target) {
    const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);

    const angle = Math.atan2(targetPos.x - looker.position.x,
                             targetPos.z - looker.position.z);
    looker.rotation.set(0, angle, 0);
  },

  /**
   * three.js switches back to framebuffer 0 after using a render target,
   * which causes issues when writing to our WebXR baseLayer's framebuffer.
   * We ensure before rendering every object in our scene that we reset our
   * framebuffer back to the baseLayer's. This is very hacky by overriding
   * all Object3D's onBeforeRender handler.
   *
   * @param {App} app
   */
  fixFramebuffer(app) {
    THREE.Object3D.prototype.onBeforeRender = () => {
      app.gl.bindFramebuffer(app.gl.FRAMEBUFFER, app.session.baseLayer.framebuffer);
    }
  },

  loadText(name,message,position) {
    if(window.app.scene.getObjectByName(name)){
      console.log('element with the same name already found');
      return;
    }
    if (typeof message === 'undefined') { message = '   Three.js\nSimple text.'; }
    if (typeof position === 'undefined') { position = new THREE.Vector3(0, 0, 0); }
    var loader = new THREE.FontLoader();
    loader.load( 'assets/helvetiker_regular.typeface.json', function ( font ) {
      var xMid, text;
      var color = 0x006699;
      var matDark = new THREE.LineBasicMaterial( {
        color: color,
        side: THREE.DoubleSide
      } );
      var matLite = new THREE.MeshBasicMaterial( {
        color: color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      } );
      var shapes = font.generateShapes( message, 5 );
      var geometry = new THREE.ShapeBufferGeometry( shapes );
      geometry.computeBoundingBox();
      xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );
      geometry.translate( xMid, 0, 0 );
      // make shape ( N.B. edge view not visible )
      text = new THREE.Mesh( geometry, matLite );
      text.name = name;
      text.position.set(position.x, position.y, position.z);
      
      window.app.model.add( text );
      // make line shape ( N.B. edge view remains visible )
      var holeShapes = [];
      for ( var i = 0; i < shapes.length; i ++ ) {
        var shape = shapes[ i ];
        if ( shape.holes && shape.holes.length > 0 ) {
          for ( var j = 0; j < shape.holes.length; j ++ ) {
            var hole = shape.holes[ j ];
            holeShapes.push( hole );
          }
        }
      }
      shapes.push.apply( shapes, holeShapes );
      var lineText = new THREE.Object3D();
      for ( var i = 0; i < shapes.length; i ++ ) {
        var shape = shapes[ i ];
        var points = shape.getPoints();
        var geometry = new THREE.BufferGeometry().setFromPoints( points );
        geometry.translate( xMid, 0, 0 );
        var lineMesh = new THREE.Line( geometry, matDark );
        lineText.name = "text001";
        lineText.add( lineMesh );
      }
      window.app.scene.add( lineText );
    } ); //end load function
  },

  loadCustomText(message,parent) {
    // if(window.app.scene.getObjectByName(name)){
    //   console.log('element with the same name already found');
    //   return;
    // }
    if (typeof message === 'undefined') { message = '   Three.js\nSimple text.'; }
    if (typeof position === 'undefined') { position = new THREE.Vector3(0, 0, 0); }
    var loader = new THREE.FontLoader();
    loader.load( 'assets/helvetiker_regular.typeface.json', function ( font ) {
      var xMid, text;
      var color = 0xffffff;
      // var matDark = new THREE.LineBasicMaterial( {
      //   color: color,
      //   side: THREE.DoubleSide
      // } );
      var matLite = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      var shapes = font.generateShapes( message, 0.01 );
      var geometry = new THREE.ShapeBufferGeometry( shapes );
      geometry.computeBoundingBox();
      xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );
      geometry.translate( xMid, 0, 0 );
      // make shape ( N.B. edge view not visible )
      text = new THREE.Mesh( geometry, matLite );
      // text.name = name;
      text.position.set(0, 0.1, 0);
      
      parent.add( text );
      // make line shape ( N.B. edge view remains visible )
      // var holeShapes = [];
      // for ( var i = 0; i < shapes.length; i ++ ) {
      //   var shape = shapes[ i ];
      //   if ( shape.holes && shape.holes.length > 0 ) {
      //     for ( var j = 0; j < shape.holes.length; j ++ ) {
      //       var hole = shape.holes[ j ];
      //       holeShapes.push( hole );
      //     }
      //   }
      // }
      // shapes.push.apply( shapes, holeShapes );
      // var lineText = new THREE.Object3D();
      // for ( var i = 0; i < shapes.length; i ++ ) {
      //   var shape = shapes[ i ];
      //   var points = shape.getPoints();
      //   var geometry = new THREE.BufferGeometry().setFromPoints( points );
      //   geometry.translate( xMid, 0, 0 );
      //   var lineMesh = new THREE.Line( geometry, matDark );
      //   lineText.name = "text001";
      //   lineText.add( lineMesh );
      // }
      // window.app.scene.add( lineText );
    } ); //end load function
  },

  loadImage(url, position, parent){
    if (typeof url === 'undefined') { url = '/assets/ArcticFox_Diffuse.png'; }
    if (typeof position === 'undefined') { var position = new THREE.Vector3(0, 0, -1); }

    var texture = new THREE.TextureLoader().load( url );
    var geometry = new THREE.PlaneGeometry( 5, 0.3 );
    var material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );
    mesh = new THREE.Mesh( geometry, material );
    mesh.name = "img001";
    mesh.position.set(parent.position.x + position.x, parent.position.y + position.y, parent.position.z + position.z);
    window.app.scene.add(mesh);
  },

  loadVideo(name, videoElementId, position){
    if(window.app.scene.getObjectByName(name)){
      console.log('video with the same name already found');
      return;
    }
    if (typeof position === 'undefined') { var position = new THREE.Vector3(0, 0, -150); }
    var video = document.getElementById( videoElementId );

    var texture = new THREE.VideoTexture( video );
    texture.needsUpdate;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;

    var geometry = new THREE.PlaneGeometry( 80, 60 );
    var material = new THREE.MeshPhongMaterial( { map: texture } );
    mesh = new THREE.Mesh( geometry, material );
    mesh.name = name;
    window.app.scene.add(mesh);
    mesh.position.set(position.x,position.y,position.z);
    // console.log(mesh.position);
    // video.src = "/assets/video.mp4";
    // console.log(video.src);
    video.load();
    video.play();
  },

  createInfoPoint(name, message, position, parent) {
    if(typeof parent === 'undefined') { parent = window.app.scene }
    if (typeof position === 'undefined') { console.log("no position found so setting origin as position"); position = new THREE.Vector3(0, 0, 0); }
    // else {console.log('position is given')}


    // CREATE POINT
    var circleGeo = new THREE.CircleGeometry( 0.02, 16 );
    var circleMat = new THREE.MeshBasicMaterial( { color: 0xadd8e6, opacity: 0.8 } );
    var circle = new THREE.Mesh( circleGeo, circleMat );
    // circle.position.copy(position);
    circle.name = name;
    circle.info = true;
    circle.message = message + " -> from circle ";

    // CREATE SIDE INFO
    // var planeGeo = new THREE.PlaneGeometry(0.4, 0.1 );
    // var planeMat = new THREE.MeshBasicMaterial( {color: 0xadd8e6, side: THREE.DoubleSide} );
    // var plane = new THREE.Mesh( planeGeo, planeMat );
    // plane.position.set( 0.3, 0, 0 );
    // plane.name = name + "plane"; 
    // plane.message = message + " -> from info ";
    // plane.info = true;

    // circle.add(plane);

    // CREATE TEXT
    var newDiv = document.createElement( 'div' );
    newDiv.addEventListener('click', function(event){
      // console.log('newdiv clicked');
      event.stopPropagation();
      window.DemoUtils.showDetails(message);
    });
    newDiv.className = 'label';
    newDiv.textContent = name;
    // newDiv.style.marginTop = '-1em';
    var newLabel = new THREE.CSS2DObject( newDiv );
    // var newLabel = new THREE.CSS3DObject( newDiv );
    newLabel.info = true;
    // newLabel.position.set( position.x, position.y, position.z );

    // CREATE GROUP
    var group = new THREE.Group();
    group.add(circle);
    // group.add(plane);
    group.add( newLabel );
    // var worldPositionOfparent = new THREE.Vector3();
    // parent.getWorldPosition(worldPositionOfparent);
    var groupPosition = new THREE.Vector3( parent.position.x + position.x, parent.position.y + position.y, parent.position.z + position.z );
    console.log(groupPosition);
    // console.log(groupPosition);
    group.position.copy(groupPosition);
    group.message = message;


    // ADD GROUP TO SCENE
    parent.add(group)
    // window.app.scene.add(group);
    // window.app.scene.add(group);

    // if camera i present -> SET group to look at camera
    if(!!window.app.camera) window.DemoUtils.lookAtOnY(group, window.app.camera);
  },

  showDetails(message){
    console.log(message);
    $('#myModal .modal-content p').text(message);
    $('#myBtn').trigger("click");
  },

  getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
};



