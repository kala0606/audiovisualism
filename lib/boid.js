// Boid class for p5.js
class Boid {
  constructor(x, y, z) {
    this.position = createVector(x, y, z);
    this.velocity = p5.Vector.random3D();
    this.acceleration = createVector(0, 0, 0);
    this.maxSpeed = 1;
    this.maxForce = 0.2;
    this.rs = 10 * M + random(30) * M;
    this.signalFactor = 0.0;
    this.index = Math.floor(random(100));
    let floatChoices = [1.0, 2.0, 3.0, 6.0];
    this.mod = Math.floor(getRandomChoice(floatChoices));
    this.avxBoid = 0;
    this.colf = color(255);
    this.colb = color(255);
  }

  update() {
    if (filteredSignal[3] > 30) {
      this.maxSpeed = 3;
    }
    
    this.colf = clr1A[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
    this.colb = clr1B[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
    
    this.signalFactor = map(filteredSignal[3], 0.0, 1.0, 0.01, 1.0);
    this.avxBoid = avx;
    
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    
    this.velocity.setMag(this.signalFactor);
  }

  applyBehaviors(boids) {
    let separateForce = this.separate(boids);
    let alignForce = this.align(boids);
    let cohesionForce = this.cohesion(boids);

    separateForce.mult(1.5);
    alignForce.mult(1.0);
    cohesionForce.mult(1.0);

    this.acceleration.add(separateForce);
    this.acceleration.add(alignForce);
    this.acceleration.add(cohesionForce);
  }

  separate(boids) {
    let desiredSeparation = 100 * M;
    let steer = createVector(0, 0, 0);
    let count = 0;

    for (let other of boids) {
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

  align(boids) {
    let neighborDist = 10 * M;
    let sum = createVector(0, 0, 0);
    let count = 0;

    for (let other of boids) {
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

  cohesion(boids) {
    let neighborDist = 100 * M;
    let sum = createVector(0, 0, 0);
    let count = 0;

    for (let other of boids) {
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
    
    if (boidCh == 0) {
      stroke(0);
      fill(this.colf);
      noStroke();
      strokeWeight(0.5 * M);
      if (this.index % this.mod == 0) {
        sphere((this.rs / 4) * ds);
      }
    }

    if (boidCh == 1) {
      stroke(0);
      fill(this.colf);
      if (rx) rotateX(this.avxBoid / 100.0);
      if (ry) rotateY(this.avxBoid / 100.0);
      if (rz) rotateZ(this.avxBoid / 100.0);
      strokeWeight(0.5 * M);
      if (this.index % this.mod == 0) {
        box(this.rs * ds);
      }
    }

    if (boidCh == 2) {
      stroke(0);
      fill(this.colf);
      if (rx) rotateX(this.avxBoid / 100.0);
      if (ry) rotateY(this.avxBoid / 100.0);
      if (rz) rotateZ(this.avxBoid / 100.0);
      strokeWeight(0.5 * M);
      if (this.index % this.mod == 0) {
        box(this.rs * ds, this.rs * 3 * ds, this.rs / 10 * ds);
      }
    }
    
    pop();
  }
} 