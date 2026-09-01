
import { ImageUploadSlide } from './ImageUploadSlide';

export default function Slide6_1({ isEditing }: { isEditing: boolean; fy?: string }) {
    return (
        <ImageUploadSlide
            title="Overall - Highlights (Image)"
            slideId="slide_6_1"
            isEditing={isEditing}
        />
    );
}
