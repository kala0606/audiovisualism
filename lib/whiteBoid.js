// WhiteBoid class - small white spheres
class WhiteBoid {
  constructor(x, y, z) {
    this.position = createVector(x, y, z);
    this.velocity = p5.Vector.random3D();
    this.acceleration = createVector(0, 0, 0);
    this.maxSpeed = 1; // Slightly slower than regular boids
    this.maxForce = 0.3;
    this.rs = random(5) * M; // Smaller base size
    this.signalFactor = 0.0;
    this.index = Math.floor(random(100));
    this.avxBoid = 0;
    this.movementAxis = Math.floor(random(2)); // 0 = horizontal, 1 = vertical
  }

  update() {
    if (filteredSignal[3] > 30) {
      this.maxSpeed = 3;
    }
    
    this.signalFactor = map(filteredSignal[3], 0.0, 1.0, 0.01, 1.0);
    this.avxBoid = avx;
    
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    
    // Constrain movement to horizontal or vertical only
    if (this.movementAxis === 0) {
      // Horizontal movement only (X and Z axes)
      this.velocity.y = 0;
    } else {
      // Vertical movement only (Y and Z axes)
      this.velocity.x = 0;
    }
    
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    
    this.velocity.setMag(this.signalFactor);
  }

  applyBehaviors(allBoids) {
    // Combine regular boids and white boids for flocking calculations
    let combinedBoids = [...boids, ...whiteBoids];
    
    let separateForce = this.separate(combinedBoids);
    let alignForce = this.align(combinedBoids);
    let cohesionForce = this.cohesion(combinedBoids);

    separateForce.mult(1.5);
    alignForce.mult(1.0);
    cohesionForce.mult(1.0);

    // Constrain forces to movement axis
    if (this.movementAxis === 0) {
      // Horizontal movement only
      separateForce.y = 0;
      alignForce.y = 0;
      cohesionForce.y = 0;
    } else {
      // Vertical movement only
      separateForce.x = 0;
      alignForce.x = 0;
      cohesionForce.x = 0;
    }

    this.acceleration.add(separateForce);
    this.acceleration.add(alignForce);
    this.acceleration.add(cohesionForce);
  }

  separate(allBoids) {
    let desiredSeparation = 80 * M; // Slightly smaller separation distance
    let steer = createVector(0, 0, 0);
    let count = 0;

    for (let other of allBoids) {
      let d = p5.Vector.dist(this.position, other.position);

      if ((d > 0) && (d < desiredSeparation)) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count);
    }

    if (steer.mag() > 0) {
      steer.normalize();
      steer.mult(this.maxSpeed);
      steer.sub(this.velocity);
      steer.limit(this.maxForce);
    }

    return steer;
  }

  align(allBoids) {
    let neighborDist = 8 * M;
    let sum = createVector(0, 0, 0);
    let count = 0;

    for (let other of allBoids) {
      let d = p5.Vector.dist(this.position, other.position);

      if ((d > 0) && (d < neighborDist)) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxForce);
      return steer;
    } else {
      return createVector(0, 0, 0);
    }
  }

  cohesion(allBoids) {
    let neighborDist = 80 * M;
    let sum = createVector(0, 0, 0);
    let count = 0;

    for (let other of allBoids) {
      let d = p5.Vector.dist(this.position, other.position);

      if ((d > 0) && (d < neighborDist)) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    } else {
      return createVector(0, 0, 0);
    }
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.normalize();
    desired.mult(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxForce);
    return steer;
  }

  edges() {
    if (this.position.x > width / 2) this.position.x = -width / 2;
    else if (this.position.x < -width / 2) this.position.x = width / 2;

    if (this.position.y > height / 2) this.position.y = -height / 2;
    else if (this.position.y < -height / 2) this.position.y = height / 2;

    if (this.position.z > 1000) this.position.z = -1000;
    else if (this.position.z < -1000) this.position.z = 1000;
  }

  display() {
    push();
    translate(this.position.x, this.position.y, this.position.z);
    
    // Always render as small white spheres
    fill(255); // Pure white
    noStroke();
    
    // Small sphere that scales with audio
    let sphereSize = (this.rs / 6) * ds; // Even smaller than regular boids
    sphere(sphereSize);
    
    pop();
  }
} 