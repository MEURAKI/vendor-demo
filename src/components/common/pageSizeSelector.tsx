// import { Listbox, Transition } from "@headlessui/react";
// import { Fragment } from "react";
// import { Check, ChevronDown } from "lucide-react"; // If you're using lucide icons

// export default function PageSizeSelector({ pageSize, setPageSize }) {
//   const options = [15, 25, 50];

//   return (
//     <div className="ml-3 flex items-center gap-2 text-xs text-gray-600">
//       <span className="whitespace-nowrap">Results per page</span>

//       <Listbox value={pageSize} onChange={(v) => setPageSize(v)}>
//         <div className="relative">
//           <Listbox.Button className="relative w-28 cursor-pointer rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-10 text-left text-xs text-gray-800 shadow-sm focus:outline-none">
//             <span className="block truncate">{pageSize}</span>
//             <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
//               <ChevronDown className="h-3 w-3 text-gray-400" />
//             </span>
//           </Listbox.Button>

//           <Transition
//             as={Fragment}
//             leave="transition ease-in duration-150"
//             leaveFrom="opacity-100"
//             leaveTo="opacity-0"
//           >
//             <Listbox.Options className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-200 bg-white py-2 shadow-lg focus:outline-none">
//               {options.map((opt) => (
//                 <Listbox.Option
//                   key={opt}
//                   value={opt}
//                   className={({ active }) =>
//                     `relative cursor-pointer select-none py-2 pl-4 pr-8 text-xs ${
//                       active ? "bg-gray-100" : "text-gray-700"
//                     }`
//                   }
//                 >
//                   {({ selected }) => (
//                     <>
//                       <span
//                         className={`block truncate ${
//                           selected ? "font-semibold text-gray-900" : ""
//                         }`}
//                       >
//                         {opt}
//                       </span>
//                       {selected && (
//                         <span className="absolute inset-y-0 right-3 flex items-center text-purple-600">
//                           <Check className="h-3 w-3" />
//                         </span>
//                       )}
//                     </>
//                   )}
//                 </Listbox.Option>
//               ))}
//             </Listbox.Options>
//           </Transition>
//         </div>
//       </Listbox>
//     </div>
//   );
// }