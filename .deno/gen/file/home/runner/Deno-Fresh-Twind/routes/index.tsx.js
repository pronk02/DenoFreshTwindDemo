/** @jsx h */ import { h } from "preact";
import { tw } from "@twind";
import Counter from "../islands/Counter.tsx";
export default function Home() {
    return /*#__PURE__*/ h("div", {
        class: tw`p-4 mx-auto max-w-screen-md`
    }, /*#__PURE__*/ h("img", {
        src: "/logo.svg",
        height: "100px",
        alt: "the fresh logo: a sliced lemon dripping with juice"
    }), /*#__PURE__*/ h("p", {
        class: tw`my-6`
    }, "Welcome to `fresh`. Try update this message in the ./routes/index.tsx file, and refresh."), /*#__PURE__*/ h(Counter, {
        start: 3
    }));
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRGVuby1GcmVzaC1Ud2luZC9yb3V0ZXMvaW5kZXgudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBAanN4IGggKi9cbmltcG9ydCB7IGggfSBmcm9tIFwicHJlYWN0XCI7XG5pbXBvcnQgeyB0dyB9IGZyb20gXCJAdHdpbmRcIjtcbmltcG9ydCBDb3VudGVyIGZyb20gXCIuLi9pc2xhbmRzL0NvdW50ZXIudHN4XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEhvbWUoKSB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzcz17dHdgcC00IG14LWF1dG8gbWF4LXctc2NyZWVuLW1kYH0+XG4gICAgICA8aW1nXG4gICAgICAgIHNyYz1cIi9sb2dvLnN2Z1wiXG4gICAgICAgIGhlaWdodD1cIjEwMHB4XCJcbiAgICAgICAgYWx0PVwidGhlIGZyZXNoIGxvZ286IGEgc2xpY2VkIGxlbW9uIGRyaXBwaW5nIHdpdGgganVpY2VcIlxuICAgICAgLz5cbiAgICAgIDxwIGNsYXNzPXt0d2BteS02YH0+XG4gICAgICAgIFdlbGNvbWUgdG8gYGZyZXNoYC4gVHJ5IHVwZGF0ZSB0aGlzIG1lc3NhZ2UgaW4gdGhlIC4vcm91dGVzL2luZGV4LnRzeFxuICAgICAgICBmaWxlLCBhbmQgcmVmcmVzaC5cbiAgICAgIDwvcD5cbiAgICAgIDxDb3VudGVyIHN0YXJ0PXszfSAvPlxuICAgIDwvZGl2PlxuICApO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGFBQWEsQ0FDYixTQUFTLENBQUMsUUFBUSxRQUFRLENBQUM7QUFDM0IsU0FBUyxFQUFFLFFBQVEsUUFBUSxDQUFDO0FBQzVCLE9BQU8sT0FBTyxNQUFNLHdCQUF3QixDQUFDO0FBRTdDLGVBQWUsU0FBUyxJQUFJLEdBQUc7SUFDN0IscUJBQ0UsQUFQSixDQUFhLENBT1IsS0FBRztRQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsMkJBQTJCLENBQUM7cUJBQ3pDLEFBUk4sQ0FBYSxDQVFOLEtBQUc7UUFDRixHQUFHLEVBQUMsV0FBVztRQUNmLE1BQU0sRUFBQyxPQUFPO1FBQ2QsR0FBRyxFQUFDLG9EQUFvRDtNQUN4RCxnQkFDRixBQWJOLENBQWEsQ0FhTixHQUFDO1FBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUM7T0FBRSwwRkFHcEIsQ0FBSSxnQkFDSixBQWpCTixDQUFhLENBaUJOLE9BQU87UUFBQyxLQUFLLEVBQUUsQ0FBQztNQUFJLENBQ2pCLENBQ047Q0FDSCxDQUFBIn0=