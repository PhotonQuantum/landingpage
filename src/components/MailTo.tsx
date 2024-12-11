import { createSignal } from "solid-js"

export interface MailToProps {
  template: string
}

export default function MailTo(props: MailToProps) {
  const [addr, setAddr] = createSignal("");

  const materialize = () => {
    const rendered = props.template.replaceAll(/\s+/g, "").replaceAll("[at]", "@").replaceAll("[dot]", ".");
    setAddr(rendered);
    return rendered
  }

  return (
    <code class="not-prose text-strong text-base p-0 md:p-0.5 bg-faint rounded-md" onClick={(ev) => {
      const rendered = materialize();
      // select the text
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(ev.currentTarget);
        selection.removeAllRanges();
        selection.addRange(range);
        navigator.clipboard.writeText(rendered);
      }
    }}>
      {addr() || props.template}
    </code>
  )
}