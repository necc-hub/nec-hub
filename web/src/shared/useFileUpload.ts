// 共享文件上传 composable（架构优化 #6）：/api/approvals/upload 统一通道
// 10MB 校验、上传中状态、失败移除并给错误文案；各模块不再各写一遍
import { ref, computed } from 'vue'

export interface UploadEntry {
  name: string
  size: number
  token?: string
  uploading: boolean
}

export function useFileUpload() {
  const uploadedFiles = ref<UploadEntry[]>([])
  const error = ref('')
  const uploading = computed(() => uploadedFiles.value.some(f => f.uploading))
  const readyFiles = computed(() =>
    uploadedFiles.value.filter(f => f.token).map(f => ({ name: f.name, token: f.token as string, size: f.size })),
  )

  async function uploadFiles(fileList: FileList | File[]) {
    error.value = ''
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) {
        error.value = `「${file.name}」超过 10MB 上限，请压缩后上传`
        continue
      }
      const entry: UploadEntry = { name: file.name, size: file.size, uploading: true }
      uploadedFiles.value.push(entry)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/approvals/upload', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        const saved = data.files?.[0]
        entry.token = saved?.key || ''
        entry.name = saved?.name || file.name
        entry.size = saved?.size ?? file.size
      } catch (err) {
        uploadedFiles.value = uploadedFiles.value.filter(f => f !== entry)
        error.value = `「${file.name}」上传失败：${(err as Error).message}`
      } finally {
        entry.uploading = false
      }
    }
  }

  function onFilesChange(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = '' // 允许重复选择同一文件
    return uploadFiles(files)
  }

  function removeFile(i: number) {
    uploadedFiles.value.splice(i, 1)
  }

  function reset() {
    uploadedFiles.value = []
    error.value = ''
  }

  return { uploadedFiles, uploading, readyFiles, error, onFilesChange, uploadFiles, removeFile, reset }
}
