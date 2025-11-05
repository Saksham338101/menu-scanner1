// Community Forum Component for meal.it
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '../utils/authenticatedApi';
import Alert from './Alert';

const CommunityForum = () => {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });

  // Form state
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    tags: '',
    author_name: ''
  });

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 4000);
  };

  // Load community posts
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      // Community posts are public, so we don't need authentication to view them
      const response = await fetch('/api/community');
      if (!response.ok) throw new Error('Failed to load community posts');
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error('Error loading community posts:', err);
      setError('Could not load community posts.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      showAlert('Please sign in to create posts', 'error');
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      showAlert('Please fill in both title and content', 'error');
      return;
    }

    try {
      const postData = {
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        tags: newPost.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        author_name: newPost.author_name.trim() || 'Anonymous'
      };

      await authenticatedPost('/api/community', postData);
      
      // Reset form
      setNewPost({ title: '', content: '', tags: '', author_name: '' });
      setShowNewPostForm(false);
      
      // Refresh posts
      await fetchPosts();
      showAlert('Post created successfully!', 'success');
    } catch (err) {
      console.error('Error creating post:', err);
      showAlert('Failed to create post. Please try again.', 'error');
    }
  };

  const handleUpvote = async (postId) => {
    if (!isAuthenticated) {
      showAlert('Please sign in to upvote posts', 'error');
      return;
    }

    try {
      await authenticatedPut('/api/community', { post_id: postId });
      await fetchPosts(); // Refresh to show new upvote count
      showAlert('Post upvoted!', 'success');
    } catch (err) {
      console.error('Error upvoting post:', err);
      showAlert('Failed to upvote post.', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Alert */}
      <Alert show={alert.show} message={alert.message} type={alert.type} />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Community Forum</h2>
        {isAuthenticated && (
          <button
            onClick={() => setShowNewPostForm(!showNewPostForm)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            {showNewPostForm ? 'Cancel' : 'New Post'}
          </button>
        )}
      </div>

      {/* New Post Form */}
      {showNewPostForm && (
        <form onSubmit={handleCreatePost} className="bg-yellow-50 rounded-lg p-4 mb-6">
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Post title..."
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Share your thoughts, ask questions, or give advice..."
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                required
              />
            </div>
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Your name (optional)"
                value={newPost.author_name}
                onChange={(e) => setNewPost({ ...newPost, author_name: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={newPost.tags}
                onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowNewPostForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Post
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Authentication Prompt for Non-Users */}
      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-center">
            <strong>Sign in to participate!</strong> Join the conversation by creating posts and upvoting content.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-center">{error}</p>
          <button
            onClick={fetchPosts}
            className="mt-2 mx-auto block bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No posts yet. Be the first to start a conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
              {/* Post Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{post.title}</h3>
                  <div className="flex items-center text-sm text-gray-500 space-x-3">
                    <span>by {post.author_name}</span>
                    <span>•</span>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpvote(post.id)}
                    disabled={!isAuthenticated}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-100 hover:bg-yellow-100 disabled:hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">{post.upvotes}</span>
                  </button>
                </div>
              </div>

              {/* Post Content */}
              <p className="text-gray-700 mb-3 whitespace-pre-wrap">{post.content}</p>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.map((tag, index) => (
                    <span key={index} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Replies */}
              {post.community_replies && post.community_replies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Replies ({post.community_replies.length})
                  </h4>
                  <div className="space-y-3">
                    {post.community_replies.slice(0, 3).map((reply) => (
                      <div key={reply.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">{reply.author_name}</span>
                          <span className="text-xs text-gray-500">{formatDate(reply.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{reply.content}</p>
                      </div>
                    ))}
                    {post.community_replies.length > 3 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... and {post.community_replies.length - 3} more replies
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityForum;