import Avatar from "./avatar.jpg";
import Image from "next/image";
import React, { Fragment } from "react";
import ActiveLink from "../../components/ActiveLink";

const pages = [
  {
    name: "Academic",
    href: "/"
  },
  {
    name: "Misc",
    href: "misc"
  },
  {
    name: "Informal",
    href: "informal"
  },
  {
    name: "Contact",
    href: "contact"
  }
];

export default function ProfileLayout({ children }) {
  return (
    <div className="container flex flex-col max-w-3xl">
      <div className="flex mx-auto p-6 justify-center">
        <div className="flex-shrink-0 relative">
          <Image className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shadow" src={Avatar} alt={"Avatar"} />
          {/*<div className="absolute bottom-0 right-0 h-4 w-6 rounded z-20 border-2 border-white shadow trans-bg" />*/}
        </div>
        <div className="hidden sn">LightQuantum</div>
        <div className="ml-6 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:space-x-2 items-baseline">
            <div className="text-xl md:text-2xl text-strong leading-tight pb-1 rn">
              Yanning Chen
            </div>
            <div className="text-xs md:text-sm text-label whitespace-nowrap">
              E53E D56B 7F20 B7BB
            </div>
          </div>
          <div className="text-sm md:text-base text-label leading-tight md:leading-normal">
            {
              pages.map(({ name, href }, i) => (
                <Fragment key={i}>
                  <ActiveLink activeClassName="link-selected" className="link" href={href}>{name}</ActiveLink>
                  {(i !== pages.length - 1) && (<span className="mx-1">|</span>)}
                </Fragment>
              ))
            }
          </div>
        </div>
      </div>
      <div className="flex flex-col mb-auto px-6 pb-6 mx-auto">
        <div className="markdown">
          {children}
        </div>
        <div className="mt-8 max-w-3xl text-xs md:text-sm text-label text-center flex flex-col sm:flex-row">
          <p className="sm:mr-auto">
            Designed by myself <a className="underline text-accent"
                                  href="https://github.com/PhotonQuantum/landingpage">[1]</a>.
          </p>
          <p>
            Last updated on {process.env.lastUpdate}.
          </p>
        </div>
      </div>

    </div>
  );
}
