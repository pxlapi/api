const {loadImage} = require('../../util/ImageScript/ImageScript');
const ImageController = require('../../util/http/controller/ImageController');

class Ajit extends ImageController {
    constructor(router) {
        super(router, '/ajit');
    }

    /**
     * @api {post} /ajit Ajit
     * @apiGroup Image Manipulation
     * @apiDescription Overlays an image of Ajit Pai snacking on some popcorn
     *
     * @apiUse ReturnsImage
     * @apiUse RequiresImage
     * @apiUse BadRequest
     * @apiUse Unauthorized
     */
    async post(context) {
        if (!context.application)
            return context.unauthorized();

        let image;
        try {
            [image] = await this.loadImagesFromContext(context, 1, 1);
        } catch (err) {
            return context.badRequest(err);
        }

        const overlay = await loadImage('./assets/ajit.png');

        image.composite(overlay.fit(image.width, image.height));

        return context.okImage(image);
    }
}

module.exports = Ajit;
