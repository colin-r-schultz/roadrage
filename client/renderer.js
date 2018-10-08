var canvas = document.getElementById('canvas');
window.onresize = () => {
    wratio = window.innerWidth / window.innerHeight;
    cratio = canvas.width / canvas.height;
    let width = 0;
    let height = 0;
    if (wratio >= cratio) {
        width = window.innerWidth;
        height = (window.innerWidth / cratio);
    } else {
        height = window.innerHeight;
        width = (window.innerHeight * cratio);
    }
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.marginLeft = ((window.innerWidth - width) / 2) + 'px';
    canvas.style.marginTop = ((window.innerHeight - height) / 2) + 'px';
};
window.onresize();

var ctx = canvas.getContext('2d');

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawLoading() {
    clear();
    ctx.fillStyle = '#000000';
    ctx.fillText('Loading... ' + (imagesLoaded*100/images.length) + '%', 0, 0);
    console.log('Loading... ' + (imagesLoaded*100/images.length) + '%');
}

function drawImageCentered(img) {
    ctx.drawImage(img, -img.width/2, -img.height/2);
}

function draw() {
    if (!game) return;
    clear();
    ctx.fillStyle = '#FF0000';
    for (let i in game.objects) {
        let object = game.objects[i];
        let x = 0
        let y = 0
        let a = 0
        if (object.physics) {
            let pos = object.physics.getPosition();
            x = pos.x;
            y = pos.y;
            a = object.physics.getAngle();
        } else if (object.position) {
            x = object.position.x;
            y = object.position.y;
        }
        x *= 10;
        y *= 10;
        ctx.translate(x, y);
        ctx.rotate(a);
        drawImageCentered(sprites['sportscar']);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}