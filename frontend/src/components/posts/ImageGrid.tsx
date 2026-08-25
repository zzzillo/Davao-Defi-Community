import { useState } from 'react'
import Icon from '../Icon'
import ImagePreview from './ImagePreview'
import type { PostImage } from '../../types/post'

type ImageGridProps = {
  images: PostImage[]
}

/**
 * A post's gallery.
 *
 * Owns one thing: which photograph is open in the lightbox. That state belongs
 * here rather than on the page, because no page ever needs to know - and a
 * page that had to hold it would be holding it for the grid's benefit alone.
 *
 * The images arrive already ordered by the API, so this renders them in the
 * order it is given and never sorts.
 */
export default function ImageGrid({ images }: ImageGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      {/*
        The first photograph spans two columns and two rows on wider screens.
        A recap usually opens on its best shot, and a uniform grid gives that
        shot no more weight than a blurry one at the end.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open photo ${index + 1} of ${images.length}`}
            className={`group relative overflow-hidden rounded-lg bg-surface-container ${
              index === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
            }`}
          >
            {image.image_url ? (
              <img
                src={image.image_url}
                // Decorative within a gallery: the post's title and caption
                // carry the meaning, and "photo 3" read aloud helps nobody.
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted">
                <Icon name="image" className="text-[28px]" />
              </span>
            )}
          </button>
        ))}
      </div>

      <ImagePreview
        images={images}
        index={openIndex}
        onSelect={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  )
}
