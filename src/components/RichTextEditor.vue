<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import LinkExtension from '@tiptap/extension-link'
import PlaceholderExtension from '@tiptap/extension-placeholder'
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const menu = ref(null)
const fileInput = ref(null)

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    ImageExtension.configure({ inline: true }),
    LinkExtension.configure({ openOnClick: false }),
    PlaceholderExtension.configure({ placeholder: props.placeholder || 'Escribe aquí…' }),
  ],
  onUpdate: () => emit('update:modelValue', editor.value?.getHTML() || ''),
})

function updateContent(html) {
  if (editor.value) editor.value.commands.setContent(html || '', false)
}
defineExpose({ updateContent })

function pickImage() {
  fileInput.value?.click()
}

function onFilePicked(e) {
  const file = e.target?.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { alert('Solo imágenes'); return }
  if (file.size > 2 * 1024 * 1024) { alert('Máximo 2 MB'); return }
  const reader = new FileReader()
  reader.onload = (ev) => {
    editor.value?.chain().focus().setImage({ src: ev.target?.result }).run()
    e.target.value = ''
  }
  reader.readAsDataURL(file)
}

function setLink() {
  const url = prompt('URL del enlace:')
  if (!url) { editor.value?.chain().focus().unsetLink().run(); return }
  editor.value?.chain().focus().setLink({ href: url }).run()
}
</script>

<template>
  <div class="border border-border rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition" v-if="editor">
    <div ref="menu" class="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-bg-app/70 no-print">
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'bg-gray-200': editor.isActive('bold') }" class="px-2 py-0.5 text-xs font-bold rounded hover:bg-gray-200 transition cursor-pointer" title="Negrita">B</button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'bg-gray-200': editor.isActive('italic') }" class="px-2 py-0.5 text-xs italic rounded hover:bg-gray-200 transition cursor-pointer" title="Cursiva">I</button>
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'bg-gray-200': editor.isActive('bulletList') }" class="px-2 py-0.5 rounded hover:bg-gray-200 transition cursor-pointer" title="Lista">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
      <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'bg-gray-200': editor.isActive('orderedList') }" class="px-2 py-0.5 rounded hover:bg-gray-200 transition cursor-pointer" title="Lista numerada">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
      </button>
      <button @click="pickImage" class="px-2 py-0.5 rounded hover:bg-gray-200 transition cursor-pointer" title="Imagen">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <button @click="setLink" :class="{ 'bg-gray-200': editor.isActive('link') }" class="px-2 py-0.5 rounded hover:bg-gray-200 transition cursor-pointer" title="Enlace">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
    </div>
    <EditorContent :editor="editor" class="prose prose-sm max-w-none px-3 py-2 min-h-[80px] focus:outline-none" />
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePicked" />
  </div>
</template>

<style>
.tiptap p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.tiptap { outline: none; }
.tiptap p { margin: 0.25em 0; }
.tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.25em 0; }
.tiptap img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
.tiptap a { color: var(--color-primary); text-decoration: underline; cursor: pointer; }
</style>
