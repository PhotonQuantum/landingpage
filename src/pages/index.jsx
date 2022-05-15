import React, { useState } from "react";
import {
  Avatar,
  AvatarFlag,
  AvatarWrapper,
  Container,
  ParagraphWrapper,
  Root,
  SummaryContainer,
  SummaryContent,
  SummarySubtitle,
  SummarySubtitleAp,
  SummarySubtitleWrapper,
  SummaryTitle,
  SummaryTitleAp,
  SummaryTitleWrapper
} from "../styles";
import { FormalProfile } from "../components/formal-profile";
import { InformalProfile } from "../components/informal-profile";

export function Home() {
  const [formal, setFormal] = useState(true);
  const toggleProfile = () => setFormal(!formal);
  const avatar = new URL("../../static/avatar.png", import.meta.url);
  return (
    <>
      <Root>
        <Container>
          <SummaryContainer>
            <AvatarWrapper>
              <Avatar src={avatar} />
              <AvatarFlag />
            </AvatarWrapper>
            <SummaryContent>
              <SummaryTitleWrapper>
                <SummaryTitle>LightQuantum</SummaryTitle>
                <SummaryTitleAp>E53E D56B 7F20 B7BB</SummaryTitleAp>
              </SummaryTitleWrapper>
              <SummarySubtitleWrapper>
                <SummarySubtitle>CS undergraduate @SJTU-19.</SummarySubtitle>
                <SummarySubtitleAp>Coding with ♡.</SummarySubtitleAp>
              </SummarySubtitleWrapper>
            </SummaryContent>
          </SummaryContainer>
          <ParagraphWrapper>
            {formal ?
              <FormalProfile toggleProfile={toggleProfile} /> :
              <InformalProfile toggleProfile={toggleProfile} />
            }
          </ParagraphWrapper>
        </Container>
      </Root>
    </>
  );
}
