// Sine class for p5.js
class Sine {
  constructor() {
    this.size = Math.max(4, Math.floor(random(5 * M, 100 * M)));
    this.index = Math.floor(random(1000 * M));
    this.avxSine = 0;
    this.colf = color(255);
    this.colb = color(255);
  }

  update() {
    this.avxSine = avx;
    this.colf = clr1A[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
    this.colb = clr1B[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
  }

  display() {
    if (sineCh == 0) {
      push();
      for (let y = -height; y < height; y += height / 10) {
        for (let x = -width; x < width; x += width / 10) {
          // Use individual colors for each sine element
          let colorIndex = Math.floor((x + y + frameCount) / 8) % clr1Num;
          fill(clr1A[colorIndex] || color(255));
          stroke(0);
          push();
          translate(
            x,
            y + sin(x + this.avxSine / 10) * height * M,
            -1000 + noise(x / 10, y / 10) * 1000 + sin(this.avxSine / 10) * 1000
          );
          rotateX(radians(noise(x, y) * 360) + this.avxSine);
          rotateY(radians(noise(x, y) * 360) + this.avxSine);
          rotateZ(radians(noise(x, y) * 360) + this.avxSine);
          box(this.size * noise(x / 100, y / 100) * ds);
          pop();
        }
      }
      pop();
    }

    if (sineCh == 1) {
      push();
      for (let y = -height; y < height; y += this.size / 10) {
        let x = 0;
        // Use individual colors for each sine element
        let colorIndex = Math.floor((y + frameCount) / 12) % clr1Num;
        fill(clr1A[colorIndex] || color(255));
        stroke(0);
        push();
        translate(
          x + sin(y / 100 + this.avxSine / 10) * width / 2 * M,
          y,
          -1000 + noise(x / 10, y / 10) * 1000 + sin(this.avxSine / 10) * 1000
        );
        rotateZ(radians(noise(x, y) * 360) + this.avxSine);
        box(sin(y / 100 + this.avxSine / 10) * this.size * M * ds);
        noStroke();
        pop();
      }
      pop();
    }

    if (sineCh == 2) {
      push();
      for (let x = -width; x < width; x += this.size / 10) {
        let y = height * sin(x / 300 + this.avxSine / 10);
        // Use individual colors for each sine element
        let colorIndex = Math.floor((x + frameCount) / 16) % clr1Num;
        fill(clr1A[colorIndex] || color(255));
        stroke(0);
        push();
        translate(
          x,
          y,
          -1000 + noise(x / 300, y / 300) * 1000 + sin(this.avxSine / 10) * 1000
        );
        rotateX(radians(noise(x / 300, y / 300) * 360) + this.avxSine / 20);
        rotateY(radians(noise(x / 300, y / 300) * 360) + this.avxSine / 10);
        rotateZ(radians(noise(x / 300, y / 300) * 360) + this.avxSine / 20);
        box(this.size * noise(x / 100, y / 100) * ds);
        pop();
      }
      pop();
    }
  }
} 