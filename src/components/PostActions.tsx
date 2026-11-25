import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { prepareEditComposerPreview } from '../lib/club-composer-preview';
import { deletePost, type FeedPost } from '../lib/feed';
import { canEditFeedPost, getPostEditRoute } from '../lib/post-edit-route';
import { submitPostReport, type ReportReason } from '../lib/reports';
import DeletePostConfirmSheet from './DeletePostConfirmSheet';
import PostOptionsSheet from './PostOptionsSheet';
import ValidationWarningSheet from './ValidationWarningSheet';

const reasons: {reason: ReportReason; label: string}[] = [
  {reason:'explicit_content', label:'Graphic or inappropriate content'},
  {reason:'hate', label:'Violence, hate, or discrimination'},
  {reason:'harassment', label:'Harassment or unwanted contact'},
  {reason:'spam', label:'Spam or fraud'},
  {reason:'impersonation', label:'Impersonation'},
  {reason:'other', label:'Other'},
];

export default function PostActions({post, currentUserId, onDismiss, onDeleted, onPin, onEditStart}: {
  post: FeedPost | null;
  currentUserId?: string | null;
  onDismiss: () => void;
  onDeleted: (post: FeedPost) => void;
  onPin?: (post: FeedPost) => void;
  onEditStart?: () => void;
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<FeedPost | null>(null);
  const [reportTarget, setReportTarget] = useState<FeedPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const own = Boolean(currentUserId && post?.author_id === currentUserId);

  function openEditor(target: FeedPost) {
    const route = getPostEditRoute(target);
    onEditStart?.();
    if (!currentUserId || target.author_id !== currentUserId) {
      router.push(route);
      return;
    }
    const previewKey = prepareEditComposerPreview({
      userId: currentUserId,
      profile: {
        display_name: target.author_display_name ?? null,
        username: target.author_username ?? null,
        avatar_url: target.author_avatar_url ?? null,
      },
    });
    router.push({...route, params:{...route.params, previewKey}});
  }

  async function confirmDelete() {
    if (!deleteTarget || pending.current || deleteTarget.author_id !== currentUserId) return;
    pending.current = true;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.id);
      setDeleteTarget(null);
      onDeleted(deleteTarget);
    } catch (error) {
      Alert.alert('Could not delete post', 'Please try again.');
      throw error;
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  }

  async function report(target: FeedPost, reason: ReportReason) {
    if (!currentUserId || target.author_id === currentUserId || pending.current) return;
    pending.current = true;
    try {
      await submitPostReport(target.id, reason);
      setNotice('Thanks for letting us know. Your report has been submitted for review.');
    } catch {
      Alert.alert('Could not submit report', 'Please try again.');
    } finally {
      pending.current = false;
    }
  }

  return <>
    <PostOptionsSheet visible={Boolean(post)} onDismiss={onDismiss}
      subtitle={own ? 'Manage your post.' : 'Actions for this post.'}
      onEdit={post && canEditFeedPost(post, currentUserId) ? () => openEditor(post) : undefined}
      onDelete={post && own ? () => setDeleteTarget(post) : undefined}
      actions={[
        ...(post && !own && currentUserId ? [{label:'Report Post',description:'Flag this post for review.',icon:'flag-outline' as const,run:()=>setReportTarget(post)}] : []),
        ...(post && onPin ? [{label:'Pin options',description:'Manage where this post is pinned.',icon:'pin-outline' as const,run:()=>onPin(post)}] : []),
      ]}/>
    {deleteTarget ? <DeletePostConfirmSheet visible busy={deleting}
      title={deleteTarget.club_discussion ? 'Delete discussion?' : 'Delete post?'}
      onDismiss={() => setDeleteTarget(null)} onConfirm={confirmDelete}/> : null}
    <PostOptionsSheet visible={Boolean(reportTarget)} title="Report post" subtitle="Why are you reporting this post?"
      onDismiss={() => setReportTarget(null)}
      actions={reportTarget ? reasons.map(({reason,label}) => ({
        label,description:'',icon:'flag-outline',run:()=>void report(reportTarget,reason),
      })) : []}/>
    <ValidationWarningSheet visible={Boolean(notice)} title="Report submitted" message={notice}
      icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={()=>setNotice('')}/>
  </>;
}
