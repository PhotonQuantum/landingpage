'use client';

import React, { useEffect, useState } from "react";

export const MailTo = ({ template }) => {
  const [emailAddress, setEmailAddress] = useState("");
  useEffect(() => {
    let screenname = document.querySelector(".sn").textContent.toLowerCase();
    let realname = document.querySelector(".rn").textContent.toLowerCase().replaceAll(" ", "");
    let realnamedot = document.querySelector(".rn").textContent.toLowerCase().replaceAll(" ", ".");
    setEmailAddress(template.replaceAll("{realname}", realname).replaceAll("{realnamedot}", realnamedot).replaceAll("{screenname}", screenname));
  }, [template]);
  return (
    <a href={`mailto:${emailAddress}`}>{emailAddress}</a>
  );
};