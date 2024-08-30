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
    name: "Links",
    href: "links"
  }
];

export default function ProfileLayout({ children }) {
  return (
    <div className="container flex flex-col max-w-3xl">
      <div className="flex mx-auto p-6 justify-center">
        <div className="flex-shrink-0 flex">
          <Image className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shadow my-auto" src={Avatar} alt={"Avatar"} />
        </div>
        <div className="hidden sn">LightQuantum</div>
        <div className="ml-6 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:space-x-2 items-baseline">
            <div className="leading-tight text-strong rn">
              <span className="text-3xl md:text-4xl font-semibold">Yanning Chen</span>
            </div>
            <div className="text-xl md:text-2xl text-strong font-light leading-tight pb-1 rn">
              <span className="font-light text-label2 pr-2">/</span>
              LightQuantum
            </div>
          </div>
          <div className="text-xs md:text-sm text-label whitespace-nowrap">
            E53E D56B 7F20 B7BB
          </div>
          <div className="text-lg md:text-xl text-label leading-tight md:leading-normal mt-2">
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
            © {process.env.lastUpdateYear} Yanning Chen.
            {/* Designed by myself <a className="underline text-accent"
                                  href="https://github.com/PhotonQuantum/landingpage">[1]</a>. */}
          </p>
          <p>
            Last updated on {process.env.lastUpdate}.
          </p>
        </div>
      </div>

    </div>
  );
}
