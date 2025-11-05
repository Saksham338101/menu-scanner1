// Next.js built-in error page for production and development
export default function Error({ statusCode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f7fa 100%)' }}>
      <h1 style={{ fontSize: '4rem', color: '#e53e3e', marginBottom: '1rem' }}>Oops!</h1>
      <h2 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '1rem' }}>
        {statusCode ? `An error ${statusCode} occurred on server` : 'An error occurred on client'}
      </h2>
      <p style={{ color: '#4a5568', fontSize: '1.2rem', marginBottom: '2rem' }}>
        Sorry, something went wrong. Please try refreshing the page or come back later.
      </p>
      <button onClick={() => window.location.reload()} style={{ padding: '0.75rem 2rem', background: '#38b2ac', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
        Refresh
      </button>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
