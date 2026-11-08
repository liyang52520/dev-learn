import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Providers } from './providers'
import { ScrollToTop } from './ScrollToTop'
import { SiteLayout } from './layout/SiteLayout'
import { AdminGuard } from '@/features/admin/auth/AdminGuard'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { NotFoundPage } from './NotFoundPage'

const HomePage = lazy(() => import('@/features/posts/pages/HomePage'))
const PostPage = lazy(() => import('@/features/posts/pages/PostPage'))
const ArchivePage = lazy(() => import('@/features/blog/pages/ArchivePage'))
const TagsPage = lazy(() => import('@/features/blog/pages/TagsPage'))
const TagPage = lazy(() => import('@/features/blog/pages/TagPage'))
const CategoriesPage = lazy(() => import('@/features/blog/pages/CategoriesPage'))
const CategoryPage = lazy(() => import('@/features/blog/pages/CategoryPage'))
const StudyIndexPage = lazy(() => import('@/features/study/pages/StudyIndexPage'))
const TopicPage = lazy(() => import('@/features/study/pages/TopicPage'))
const QuestionPage = lazy(() => import('@/features/study/pages/QuestionPage'))
const ReviewPage = lazy(() => import('@/features/review/pages/ReviewPage'))
const AdminLoginPage = lazy(() => import('@/features/admin/auth/AdminLoginPage'))
const AdminListPage = lazy(() => import('@/features/admin/posts/AdminListPage'))
const AdminEditorPage = lazy(() => import('@/features/admin/posts/AdminEditorPage'))
const AdminPreviewPage = lazy(() => import('@/features/admin/posts/AdminPreviewPage'))
const AdminStudyPage = lazy(() => import('@/features/admin/study/AdminStudyPage'))
const AdminBackupPage = lazy(() => import('@/features/admin/backup/AdminBackupPage'))

const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

export function App() {
  return (
    <Providers>
      <BrowserRouter basename={basename}>
        <ScrollToTop />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route
              element={
                <AdminGuard>
                  <SiteLayout />
                </AdminGuard>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="posts/:slug" element={<PostPage />} />
              <Route path="blog/archive" element={<ArchivePage />} />
              <Route path="blog/tags" element={<TagsPage />} />
              <Route path="blog/tags/:tag" element={<TagPage />} />
              <Route path="blog/categories" element={<CategoriesPage />} />
              <Route path="blog/categories/:category" element={<CategoryPage />} />
              <Route path="study" element={<StudyIndexPage />} />
              <Route path="study/:topic" element={<TopicPage />} />
              <Route path="study/:topic/:qid" element={<QuestionPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route
              path="review"
              element={
                <AdminGuard>
                  <ReviewPage />
                </AdminGuard>
              }
            />
            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route
              path="admin"
              element={
                <AdminGuard>
                  <AdminListPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/study"
              element={
                <AdminGuard>
                  <AdminStudyPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/backup"
              element={
                <AdminGuard>
                  <AdminBackupPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/edit/:type/:slug"
              element={
                <AdminGuard>
                  <AdminEditorPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/preview/:type/:slug"
              element={
                <AdminGuard>
                  <AdminPreviewPage />
                </AdminGuard>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Providers>
  )
}
