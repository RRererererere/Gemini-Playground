# Image Analyser Changelog

## v1.1.0 - Image ID Tracking

### Added

- **Image ID parameter**: New `image_id` parameter for referencing images by alias (e.g., `img_1`, `img_2`)
- **Image aliases**: Automatic generation of short, stable aliases for all images in chat
- **Image context**: System prompt now includes list of available images with their aliases
- **Better error messages**: Shows available image aliases when image not found

### Changed

- **Deprecated `image_index`**: Still works for backward compati