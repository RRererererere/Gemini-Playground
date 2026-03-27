# Image Analyser Changelog

## v1.1.0 - Image ID Tracking

### Added

- **Image ID parameter**: New `image_id` parameter for referencing images by their real file ID (e.g., `ph_abc123`)
- **Direct ID access**: Images are now referenced by their actual file IDs instead of temporary aliases
- **Image context**: System prompt now includes list of available images with their IDs
- **Better error messages**: Shows available image aliases when image not found

### Changed

- **Deprecated `image_index`**: Still works for backward compati