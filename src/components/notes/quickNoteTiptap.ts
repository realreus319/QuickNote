import { mergeAttributes, Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

interface QuickNoteImageAttributeMap {
  src?: unknown
  alt?: unknown
  'data-attachment-id'?: unknown
  attachmentId?: unknown
}

export interface QuickNoteImageAttrs {
  src: string
  alt: string
  attachmentId: string
}

function readFigureImage(element: Element) {
  if (element instanceof HTMLImageElement) {
    return element
  }

  return element.querySelector('img')
}

function readStringAttribute(attributes: QuickNoteImageAttributeMap, key: keyof QuickNoteImageAttributeMap) {
  const value = attributes[key]

  return typeof value === 'string' ? value : ''
}

const QuickNoteImage = Node.create({
  name: 'quickNoteImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      alt: {
        default: '',
      },
      attachmentId: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-attachment-id') ??
          readFigureImage(element)?.getAttribute('data-attachment-id') ??
          '',
        renderHTML: (attributes: QuickNoteImageAttributeMap) => {
          const attachmentId = readStringAttribute(attributes, 'attachmentId')

          return attachmentId ? { 'data-attachment-id': attachmentId } : {}
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            return false
          }

          const image = readFigureImage(node)

          if (!image) {
            return false
          }

          return {
            src: image.getAttribute('src') ?? '',
            alt: image.getAttribute('alt') ?? '',
            attachmentId:
              image.getAttribute('data-attachment-id') ??
              node.getAttribute('data-attachment-id') ??
              '',
          }
        },
      },
      {
        tag: 'img[data-attachment-id]',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            return false
          }

          return {
            src: node.getAttribute('src') ?? '',
            alt: node.getAttribute('alt') ?? '',
            attachmentId: node.getAttribute('data-attachment-id') ?? '',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const imgAttributes: Record<string, string> = {
      src: readStringAttribute(HTMLAttributes as QuickNoteImageAttributeMap, 'src'),
    }

    const alt = readStringAttribute(HTMLAttributes as QuickNoteImageAttributeMap, 'alt')
    const attachmentId = readStringAttribute(
      HTMLAttributes as QuickNoteImageAttributeMap,
      'data-attachment-id',
    )

    if (alt) {
      imgAttributes.alt = alt
    }

    if (attachmentId) {
      imgAttributes['data-attachment-id'] = attachmentId
    }

    return [
      'figure',
      {
        'data-quicknote-image': 'true',
      },
      ['img', mergeAttributes(imgAttributes)],
    ]
  },
})

export function buildQuickNoteTiptapExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        enableClickSelection: true,
        HTMLAttributes: {
          rel: null,
          target: null,
        },
      },
    }),
    QuickNoteImage,
  ]
}
