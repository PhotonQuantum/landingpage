import React from "react";
import { A, Paragraph } from "../styles";

export const InformalProfile = ({ toggleProfile }) => {
  return (
    <>
      <Paragraph>
        <p>INFP-T | She/Her | Archlinux | Rustacean | Vim | SHRES | Keyboardist</p>
        <p>Cognitive functions: Se Ne Ti Fe</p>
      </Paragraph>
      <Paragraph>
        <p>I'm willing to share my thoughts and feelings.</p>
        <A href="https://blog.lightquantum.me">Blog (zh-Hans)</A>
      </Paragraph>
      <Paragraph>
        <p>I love to connect with people. PMs are welcomed.</p>
        <A href="https://twitter.com/LightQuantumhah" target="_blank"
           rel="noopener">Twitter</A> | <A
        href="https://t.me/lightquantum" target="_blank" rel="noopener">Telegram</A>
      </Paragraph>
      <Paragraph>
        <p>Disclaimer: You may be banned if you keep posting racist or sexist comments, or bombarding me with
          politics.</p>
      </Paragraph>
      <Paragraph alternative>
        <p>You may want to read my <A alternative href="#" onClick={(e) => {
          e.preventDefault();
          toggleProfile();
        }}>formal profile</A>.
        </p>
      </Paragraph>
    </>
  );
};
