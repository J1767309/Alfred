'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummaryContentProps {
  content: string;
}

export default function SummaryContent({ content }: SummaryContentProps) {
  return (
    <div className="summary-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings with distinct styling
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-dark-border first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-white mt-8 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-brand-primary rounded-full"></span>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-gray-200 mt-6 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium text-gray-300 mt-4 mb-2">
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-300 leading-relaxed mb-4">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-none space-y-2 mb-4 ml-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 ml-1 text-gray-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-300 flex items-start gap-2">
              <span className="text-brand-primary mt-1.5 flex-shrink-0">•</span>
              <span className="flex-1">{children}</span>
            </li>
          ),

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-gray-200">
              {children}
            </em>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-primary/50 pl-4 py-2 my-4 bg-dark-hover/30 rounded-r-lg">
              <div className="text-gray-300 italic">{children}</div>
            </blockquote>
          ),

          // Code blocks
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-dark-hover px-1.5 py-0.5 rounded text-brand-primary text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-dark-hover p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-300 my-4">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-dark-hover rounded-lg overflow-x-auto my-4">
              {children}
            </pre>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-dark-border">
              <table className="w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-dark-hover border-b border-dark-border">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-dark-border">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-dark-hover/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-gray-300">
              {children}
            </td>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-8 border-dark-border" />
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-brand-primary hover:text-brand-primary/80 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
