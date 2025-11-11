import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || String(err) };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Runtime error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Đã xảy ra lỗi khi tải ứng dụng.</h2>
          <p style={{ color: "#c00" }}>{this.state.message}</p>
          <button onClick={() => location.reload()}>Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

