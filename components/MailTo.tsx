'use client';

import React, { useEffect, useState } from "react";

export const MailTo = ({ template }) => {
  const [emailAddress, setEmailAddress] = useState("");
  useEffect(() => {
    let screenname = document.querySelector(".sn").textContent.toLowerCase();
    let realname = document.querySelector(".rn").textContent.toLowerCase().replaceAll(" ", "");
    let realnamedot = document.querySelector(".rn").textContent.toLowerCase().replaceAll(" ", ".");
    let firstname = document.querySelector(".rn").textContent.toLowerCase().split(" ")[0];
    let lastname = document.querySelector(".rn").textContent.toLowerCase().split(" ")[1];
    setEmailAddress(template.replaceAll("{realname}", realname).replaceAll("{realnamedot}", realnamedot).replaceAll("{screenname}", screenname)
      .replaceAll("{firstname}", firstname).replaceAll("{lastname}", lastname));
  }, [template]);
  return (
    <a href={`mailto:${emailAddress}`}>{emailAddress}</a>
  );
};
