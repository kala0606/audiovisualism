// Grid class for p5.js
class Grid {
  constructor() {
    this.size = Math.max(4, Math.floor(random(50 * M, 1000 * M)));
    this.index = Math.floor(random((width / this.size) * M));
    this.avxGrid = 0;
    this.colf = color(0);
    this.colb = color(0);
  }

  update() {
    if (filteredSignal[3] > 10) {
      let floatChoices = [50.0, 100.0, 300.0];
      // this.size = Math.floor(getRandomChoice(floatChoices));
    }
    this.colf = clr1A[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
    this.colb = clr1B[Math.floor(this.index + frameCount / 2) % clr1Num] || color(255);
    this.avxGrid = avx;
  }

  display() {
    if (gridCh == 0) {
      push();
      for (let x = -width; x < width; x += this.size) {
        for (let y = -height / 2; y < height / 2; y += this.size) {
          // Use individual colors for each grid element
          let colorIndex = Math.floor((x + y + frameCount) / 10) % clr1Num;
          fill(clr1A[colorIndex] || color(255));
          stroke(0);
          strokeWeight(0.5);
          push();
          translate(
            x,
            y,
            -2000 + noise(x / 10, y / 10) * 1000 + sin(this.avxGrid / 10) * 1000
          );
          rotateY(radians(noise(x, y) * 360) + this.avxGrid);
          rect(0, 0, this.size * noise(x / 100, y / 100) * ds, this.size * 2 * noise(x / 100, y / 100) * ds);
          pop();
        }
      }
      pop();
    }

    if (gridCh == 1) {
      push();
      for (let x = -width; x < width; x += this.size) {
        for (let y = -height / 2; y < height / 2; y += this.size) {
          // Use individual colors for each grid element
          let colorIndex = Math.floor((x + y + frameCount) / 15) % clr1Num;
          fill(clr1A[colorIndex] || color(255));
          stroke(0);
          strokeWeight(0.5);
          push();
          translate(
            x,
            y + noise(x / 10, y / 10) * 1000,
            0
          );
          rotateY(radians(noise(x, y) * 360) + this.avxGrid);
          rect(0, 0, this.size * noise(x / 100, y / 100) * ds, this.size * 2 * noise(x / 100, y / 100) * ds);
          pop();
        }
      }
      pop();
    }

    if (gridCh == 2) {
      push();
      for (let x = -width; x < width; x += this.size) {
        for (let y = -height / 2; y < height / 2; y += this.size) {
          // Use individual colors for each grid element
          let colorIndex = Math.floor((x + y + frameCount) / 20) % clr1Num;
          fill(clr1A[colorIndex] || color(255));
          stroke(0);
          strokeWeight(0.5);
          push();
          translate(
            x + noise(x / 10, y / 10) * 1000 - sin(this.avxGrid / 10) * 100,
            y,
            0
          );
          rotateY(radians(noise(x, y) * 360) + this.avxGrid);
          rect(0, 0, this.size * noise(x / 100, y / 100) * ds, this.size * 2 * noise(x / 100, y / 100) * ds);
          pop();
        }
      }
      pop();
    }
  }
} 