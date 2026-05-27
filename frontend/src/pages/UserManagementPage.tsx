import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  Shield,
  User,
  Camera,
  Upload,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Brain,
  Terminal,
} from "lucide-react"

import apiClient from "../lib/axios"

type Role = {
  id: number
  name: string
}

type Zone = {
  id: number
  name: string
}

type ZonePermission = {
  id: number
  zone: Zone
}

type UserType = {
  id: number
  employee_id: string
  name: string
  email: string
  role_id: number
  is_active: boolean
  profile_image: string | null
  is_trained: boolean
  created_at: string
  role?: Role
  zone_permissions: ZonePermission[]
}

type PaginatedResponse = {
  success: boolean
  message: string
  data: UserType[]
  total: number
  page: number
  page_size: number
  pages: number
}

const roles = [
  { id: 1, name: "SUPER_ADMIN" },
  { id: 2, name: "ADMIN" },
  { id: 3, name: "SUPERVISOR" },
  { id: 4, name: "USER" },
]

const MIN_TRAINING_IMAGES = 10

const initialForm = {
  employee_id: "",
  name: "",
  email: "",
  password: "",
  role_id: 4,
  is_active: true,
  profile_image: "",
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] =
    useState<UserType | null>(null)

  const [form, setForm] = useState(initialForm)

  // ── image upload state ──────────────────
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTargetUser, setUploadTargetUser] = useState<UserType | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── train modal state ──────────────────
  const [showTrainModal, setShowTrainModal] = useState(false)
  const [trainTargetUser, setTrainTargetUser] = useState<UserType | null>(null)
  const [trainLogs, setTrainLogs] = useState<string>("")
  const [training, setTraining] = useState(false)
  const [trainDone, setTrainDone] = useState(false)
  const [trainSuccess, setTrainSuccess] = useState<boolean | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        u.email
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        u.employee_id
          .toLowerCase()
          .includes(search.toLowerCase())
    )
  }, [users, search])

  async function fetchUsers() {
    try {
      setLoading(true)

      const res = await apiClient.get<
        PaginatedResponse
      >("/users", {
        params: {
          page,
          page_size: 20,
        },
      })

      setUsers(res.data.data || [])
      setPages(res.data.pages || 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page])

  function openCreateModal() {
    setEditingUser(null)
    setForm(initialForm)
    setShowModal(true)
  }

  function openEditModal(user: UserType) {
    setEditingUser(user)

    setForm({
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      password: "",
      role_id: user.role_id,
      is_active: user.is_active,
      profile_image: user.profile_image || "",
    })

    setShowModal(true)
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    try {
      setLoading(true)

      const payload: any = {
        employee_id: form.employee_id,
        name: form.name,
        email: form.email,
        role_id: form.role_id,
        is_active: form.is_active,
        profile_image: form.profile_image,
      }

      if (form.password) {
        payload.password = form.password
      }

      if (editingUser) {
        await apiClient.patch(
          `/users/${editingUser.id}`,
          payload
        )
      } else {
        await apiClient.post(
          "/users",
          payload
        )
      }

      await fetchUsers()

      setShowModal(false)
      setEditingUser(null)
      setForm(initialForm)
    } catch (err) {
      console.error(err)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  // ── image upload helpers ────────────────

  function openUploadModal(user: UserType) {
    setUploadTargetUser(user)
    setSelectedFiles([])
    setPreviews([])
    setUploadError(null)
    setUploadSuccess(false)
    setShowUploadModal(true)
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const existing = selectedFiles.length + (uploadTargetUser?.zone_permissions ? 0 : 0) // just selectedFiles
    const combined = [...selectedFiles, ...files]

    setSelectedFiles(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    setUploadError(null)

    // reset input so same files can be re-picked
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removePreview(idx: number) {
    const next = selectedFiles.filter((_, i) => i !== idx)
    setSelectedFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  async function handleImageUpload() {
    if (!uploadTargetUser) return

    const existingCount = uploadTargetUser.zone_permissions
      ? 0
      : 0 // we track via worker_images but type doesn't expose it; backend validates

    if (selectedFiles.length < MIN_TRAINING_IMAGES) {
      setUploadError(
        `Please select at least ${MIN_TRAINING_IMAGES} images. You've selected ${selectedFiles.length}.`
      )
      return
    }

    try {
      setUploading(true)
      setUploadError(null)

      const formData = new FormData()
      selectedFiles.forEach((file) => formData.append("images", file))

      await apiClient.post(
        `/users/${uploadTargetUser.id}/images`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )

      setUploadSuccess(true)
      await fetchUsers()

      setTimeout(() => {
        setShowUploadModal(false)
        setUploadTargetUser(null)
      }, 1500)
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Upload failed. Please try again."
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  // ── train helpers ──────────────────

  function openTrainModal(user: UserType) {
    setTrainTargetUser(user)
    setTrainLogs("")
    setTraining(false)
    setTrainDone(false)
    setTrainSuccess(null)
    setShowTrainModal(true)
  }

  async function startTraining() {
    if (!trainTargetUser) return

    setTraining(true)
    setTrainLogs("")
    setTrainDone(false)
    setTrainSuccess(null)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/${trainTargetUser.id}/train`,
        {
          method: "POST",
          credentials: "include",
        }
      )

      if (!res.ok || !res.body) {
        throw new Error("Training request failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let fullLog = ""
      let succeeded = false

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, {
          stream: true,
        })

        fullLog += chunk

        setTrainLogs(fullLog)

        setTimeout(() => {
          logEndRef.current?.scrollIntoView({
            behavior: "smooth",
          })
        }, 50)

        if (
          chunk.includes(
            "[TRAINING COMPLETE]"
          )
        ) {
          succeeded = true
        }
      }

      setTrainSuccess(succeeded)
      setTrainDone(true)

      await apiClient.post(
        `/users/${trainTargetUser.id}/train/commit`
      )

      await fetchUsers()
    } catch (err: any) {
      setTrainLogs(
        (prev) =>
          prev + `\nError: ${err.message}`
      )

      setTrainSuccess(false)
      setTrainDone(true)
    } finally {
      setTraining(false)
    }
  }

  async function handleDelete(userId: number) {
    const ok = confirm(
      "Delete this user?"
    )

    if (!ok) return

    try {
      setLoading(true)

      await apiClient.delete(
        `/users/${userId}`
      )

      await fetchUsers()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-slate-900 shadow-sm">
          {/* HEADER */}
          <div className="flex flex-col gap-4 border-b border-gray-200 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                User Management
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Manage system users and
                permissions
              </p>
            </div>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              <Plus size={18} />
              Add User
            </button>
          </div>

          {/* SEARCH */}
          <div className="border-b border-gray-200 p-6">
            <div className="relative max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-slate-400 py-3 pl-10 pr-4 outline-none focus:border-black"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-4">
                    User
                  </th>

                  <th className="px-6 py-4">
                    Role
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                  <th className="px-6 py-4">
                    Face Training
                  </th>

                  <th className="px-6 py-4">
                    Zones
                  </th>

                  <th className="px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center"
                    >
                      <Loader2 className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-gray-100"
                    >
                      {/* USER */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-400">
                            {user.profile_image ? (
                              <img
                                src={
                                  user.profile_image
                                }
                                alt={user.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User size={20} />
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">
                              {user.name}
                            </p>

                            <p className="text-sm text-gray-500">
                              {user.email}
                            </p>

                            <p className="text-xs text-gray-400">
                              {
                                user.employee_id
                              }
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-400 px-3 py-1 text-sm">
                          <Shield size={14} />

                          {user.role?.name}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${user.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                            }`}
                        >
                          {user.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      {/* TRAINING */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Camera size={16} />

                          <span
                            className={`text-sm font-medium ${user.is_trained
                                ? "text-green-600"
                                : "text-orange-600"
                              }`}
                          >
                            {user.is_trained
                              ? "Trained"
                              : "Not Trained"}
                          </span>
                        </div>
                      </td>

                      {/* ZONES */}
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {user
                            .zone_permissions
                            ?.length > 0 ? (
                            user.zone_permissions.map(
                              (z) => (
                                <span
                                  key={z.id}
                                  className="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700"
                                >
                                  {
                                    z.zone
                                      ?.name
                                  }
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-sm text-gray-400">
                              No Zones
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                            className="rounded-lg border border-gray-300 p-2 hover:bg-gray-100"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => openUploadModal(user)}
                            title="Upload training images"
                            className="rounded-lg border border-blue-300 p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Camera size={16} />
                          </button>

                          <button
                            onClick={() => openTrainModal(user)}
                            title="Train face model"
                            className="rounded-lg border border-purple-300 p-2 text-purple-600 hover:bg-purple-50"
                          >
                            <Brain size={16} />
                          </button>

                          <button
                            onClick={() => handleDelete(user.id)}
                            title="Delete user"
                            className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between border-t border-gray-200 p-6">
            <p className="text-sm text-gray-500">
              Page {page} of {pages}
            </p>

            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() =>
                  setPage((p) => p - 1)
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>

              <button
                disabled={page >= pages}
                onClick={() =>
                  setPage((p) => p + 1)
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TRAIN MODAL ── */}
      {showTrainModal && trainTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-3xl bg-slate-900 shadow-2xl" style={{ maxHeight: "90vh" }}>

            {/* header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                  <Brain size={20} className="text-purple-400" />
                  Face Training
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {trainTargetUser.name} &middot; {trainTargetUser.employee_id}
                </p>
              </div>
              <button
                onClick={() => !training && setShowTrainModal(false)}
                className="text-slate-400 hover:text-white disabled:opacity-30"
                disabled={training}
              >
                <X size={22} />
              </button>
            </div>

            {/* status bar */}
            <div className={`flex items-center gap-2 px-6 py-3 text-sm ${trainSuccess === true
                ? "bg-green-950 text-green-400"
                : trainSuccess === false
                  ? "bg-red-950 text-red-400"
                  : training
                    ? "bg-purple-950 text-purple-300"
                    : "bg-slate-800 text-slate-400"
              }`}>
              {training && <Loader2 size={15} className="animate-spin" />}
              {trainSuccess === true && <CheckCircle2 size={15} />}
              {trainSuccess === false && <AlertCircle size={15} />}
              {!training && trainSuccess === null && <Terminal size={15} />}
              <span>
                {training
                  ? "Training in progress… this may take a few minutes"
                  : trainSuccess === true
                    ? "Training complete — embeddings saved ✓"
                    : trainSuccess === false
                      ? "Training failed — see logs below"
                      : "Ready to train"}
              </span>
            </div>

            {/* log terminal */}
            <div className="flex-1 overflow-y-auto bg-black px-5 py-4" style={{ minHeight: 260, fontFamily: "monospace", fontSize: 12 }}>
              {trainLogs ? (
                <>
                  <pre className="whitespace-pre-wrap text-green-300">{trainLogs}</pre>
                  <div ref={logEndRef} />
                </>
              ) : (
                <p className="text-slate-600">Logs will appear here when training starts…</p>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between border-t border-slate-700 px-6 py-4">
              <p className="text-xs text-slate-500">
                Script: <code className="text-slate-400">models/2_augment_faces.py</code>
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  disabled={training}
                  className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={startTraining}
                  disabled={training || (trainDone && trainSuccess === true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {training ? (
                    <><Loader2 size={16} className="animate-spin" /> Training…</>
                  ) : trainDone && trainSuccess ? (
                    <><CheckCircle2 size={16} /> Done</>
                  ) : (
                    <><Brain size={16} /> Start Training</>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── IMAGE UPLOAD MODAL ── */}
      {showUploadModal && uploadTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 p-6 shadow-2xl">

            {/* header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Upload Training Images</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {uploadTargetUser.name} &middot; {uploadTargetUser.employee_id}
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            {/* requirement note */}
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-3 text-sm text-blue-300">
              <ImagePlus size={16} className="shrink-0" />
              Minimum <strong className="mx-1">{MIN_TRAINING_IMAGES}</strong> images required for face training.
              Selected: <strong className="ml-1">{selectedFiles.length}</strong>
            </div>

            {/* drop / pick area */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-600 py-8 text-slate-400 transition hover:border-blue-500 hover:text-blue-400"
            >
              <Upload size={28} />
              <span className="text-sm">Click to pick images &nbsp;(jpg, png, webp)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />

            {/* previews */}
            {previews.length > 0 && (
              <div className="mb-4 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={src}
                      alt={`preview-${idx}`}
                      className="h-20 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePreview(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-600"
                    >
                      <X size={12} />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* error / success */}
            {uploadError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-950 px-4 py-3 text-sm text-red-400">
                <AlertCircle size={16} className="shrink-0" />
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-950 px-4 py-3 text-sm text-green-400">
                <CheckCircle2 size={16} className="shrink-0" />
                Images uploaded successfully!
              </div>
            )}

            {/* progress bar */}
            {selectedFiles.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>{selectedFiles.length} / {MIN_TRAINING_IMAGES} minimum</span>
                  <span>{Math.min(100, Math.round((selectedFiles.length / MIN_TRAINING_IMAGES) * 100))}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${selectedFiles.length >= MIN_TRAINING_IMAGES
                        ? "bg-green-500"
                        : "bg-blue-500"
                      }`}
                    style={{ width: `${Math.min(100, (selectedFiles.length / MIN_TRAINING_IMAGES) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImageUpload}
                disabled={uploading || selectedFiles.length < MIN_TRAINING_IMAGES}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                ) : (
                  <><Upload size={16} /> Upload {selectedFiles.length} Image{selectedFiles.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingUser
                  ? "Edit User"
                  : "Create User"}
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
              >
                <X />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Employee ID"
                  value={form.employee_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      employee_id:
                        e.target.value,
                    })
                  }
                  className="rounded-xl border border-gray-300 px-4 py-3"
                  required
                />

                <input
                  type="text"
                  placeholder="Full Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  className="rounded-xl border border-gray-300 px-4 py-3"
                  required
                />
              </div>

              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                required
              />

              <input
                type="password"
                placeholder={
                  editingUser
                    ? "New Password (optional)"
                    : "Password"
                }
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password:
                      e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3"
                required={!editingUser}
              />

              {/* profile image URL only shown on create; on edit it is set via upload */}
              {!editingUser && (
                <input
                  type="text"
                  placeholder="Profile Image URL (optional)"
                  value={form.profile_image}
                  onChange={(e) =>
                    setForm({ ...form, profile_image: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <select
                  value={form.role_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role_id: Number(
                        e.target.value
                      ),
                    })
                  }
                  className="rounded-xl border border-gray-300 px-4 py-3"
                >
                  {roles.map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                    >
                      {role.name}
                    </option>
                  ))}
                </select>

                <select
                  value={String(
                    form.is_active
                  )}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      is_active:
                        e.target.value ===
                        "true",
                    })
                  }
                  className="rounded-xl border border-gray-300 px-4 py-3"
                >
                  <option value="true">
                    Active
                  </option>

                  <option value="false">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="rounded-xl border border-gray-300 px-5 py-3"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-black px-5 py-3 text-white"
                >
                  {editingUser
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}