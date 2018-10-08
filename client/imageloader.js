var images = ['sportscar'];

var sprites = {};

var imagesLoaded = 0;
var loaded = false;

drawLoading();

for (i = 0; i < images.length; i++) {
    let img = new Image();
    img.src = '/client/images/' + images[i] + '.png';
    img.onload = function() {
        imagesLoaded++;
        if (imagesLoaded === images.length)
            loaded = true;
        drawLoading();
    };
    sprites[images[i]] = img;
}